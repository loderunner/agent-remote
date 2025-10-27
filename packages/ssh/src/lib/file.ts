import type {
  FileEditInput,
  FileEditOutput,
  FileReadInput,
  FileReadOutput,
  FileWriteInput,
  FileWriteOutput,
} from '@claude-remote/core';
import {
  fileEditInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
} from '@claude-remote/core';
import { structuredPatch } from 'diff';
import { Client, SFTPWrapper } from 'ssh2';

/**
 * Interface for file operations
 */
type ReaderWriter = {
  read(filePath: string): Promise<string>;
  write(filePath: string, content: string): Promise<void>;
};

/**
 * SFTP-based file operations implementation
 */
class SFTPReaderWriter implements ReaderWriter {
  constructor(private readonly sftp: SFTPWrapper) {}

  async read(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.sftp.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data.toString());
      });
    });
  }

  async write(filePath: string, content: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.sftp.writeFile(filePath, content, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

/**
 * Shell command-based file operations implementation
 */
class BashReaderWriter implements ReaderWriter {
  constructor(private readonly client: Client) {}

  async read(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const command = `cat ${JSON.stringify(filePath)}`;
      this.client.exec(command, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }

        let output = '';
        let errorOutput = '';

        channel.on('data', (data: Buffer) => {
          output += data.toString();
        });

        channel.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        channel.on('error', (err: unknown) => {
          reject(err);
        });

        channel.on('close', (code: number) => {
          if (code !== 0) {
            reject(
              new Error(errorOutput || `Command failed with code ${code}`),
            );
            return;
          }
          resolve(output);
        });
      });
    });
  }

  async write(filePath: string, content: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Escape single quotes by replacing ' with '\''
      const escapedContent = content.replace(/'/g, "'\\''");
      // Use printf %s to write content without adding newlines
      // Add sync to ensure data is flushed to disk before returning
      const command = `printf '%s' '${escapedContent}' > ${JSON.stringify(filePath)} && sync`;

      this.client.exec(command, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }

        let errorOutput = '';

        // Consume stdout (should be empty for redirect)
        channel.on('data', () => {
          // Discard stdout
        });

        channel.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        channel.on('error', (err: unknown) => {
          reject(err);
        });

        channel.on('close', (code: number) => {
          if (code !== 0) {
            reject(
              new Error(errorOutput || `Command failed with code ${code}`),
            );
            return;
          }
          resolve();
        });
      });
    });
  }
}

/**
 * File tool that delegates to either SFTP or shell-based operations
 */
export class FileTool {
  private readonly operations: ReaderWriter;

  constructor(transport: SFTPWrapper | Client) {
    // Type guard: SFTPWrapper has readFile method, Client has exec method
    if (transport instanceof Client) {
      this.operations = new BashReaderWriter(transport);
    } else {
      this.operations = new SFTPReaderWriter(transport);
    }
  }

  public async read(input: FileReadInput): Promise<FileReadOutput> {
    fileReadInputSchema.parse(input);

    const content = await this.operations.read(input.file_path);

    const allLines = content.split('\n');
    const totalLines = allLines.length;

    let startLine = 1;
    let lines = allLines;

    if (input.offset !== undefined) {
      startLine = Math.max(1, Math.trunc(input.offset));
      lines = allLines.slice(startLine - 1);
    }

    if (input.limit !== undefined) {
      const limit = Math.max(0, Math.trunc(input.limit));
      lines = lines.slice(0, limit);
    }

    const resultContent = lines.join('\n');
    const numLines = lines.length;

    return {
      content: resultContent,
      numLines,
      startLine,
      totalLines,
    };
  }

  public async write(input: FileWriteInput): Promise<FileWriteOutput> {
    fileWriteInputSchema.parse(input);

    await this.operations.write(input.file_path, input.content);

    return {
      content: input.content,
    };
  }

  /**
   * Edits a file by replacing text and generates a unified diff
   */
  public async edit(input: FileEditInput): Promise<FileEditOutput> {
    fileEditInputSchema.parse(input);

    const oldContent = await this.operations.read(input.file_path);

    // Count replacements and perform the replacement
    let replacements = 0;
    let newContent: string;

    if (input.replace_all) {
      // Count how many times the string appears
      const regex = new RegExp(
        input.old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      );
      const matches = oldContent.match(regex);
      replacements = matches ? matches.length : 0;
      newContent = oldContent.replaceAll(input.old_string, input.new_string);
    } else {
      // Replace only the first occurrence
      if (oldContent.includes(input.old_string)) {
        replacements = 1;
        newContent = oldContent.replace(input.old_string, input.new_string);
      } else {
        replacements = 0;
        newContent = oldContent;
      }
    }

    await this.operations.write(input.file_path, newContent);

    // Generate unified diff
    const diff = structuredPatch(
      input.file_path,
      input.file_path,
      oldContent,
      newContent,
      undefined,
      undefined,
      { context: 3 },
    );

    return { replacements, diff };
  }
}
