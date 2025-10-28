import { spawn } from 'node:child_process';

import type {
  FileEditInput,
  FileEditOutput,
  FileReadInput,
  FileReadOutput,
  FileWriteInput,
  FileWriteOutput,
} from '@agent-remote/core';
import {
  fileEditInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
} from '@agent-remote/core';
import { structuredPatch } from 'diff';

import { ToolConfig } from './remote';

/**
 * File tool that uses docker exec for file operations
 */
export class FileTool {
  private readonly container: string;
  private readonly shell: string;

  constructor(config: ToolConfig) {
    this.container = config.container;
    this.shell = config.shell;
  }

  private async execCommand(args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const process = spawn('docker', ['exec', '-i', this.container, ...args]);

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      process.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      process.on('error', (err: unknown) => {
        reject(err);
      });

      process.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new Error(errorOutput || `Command failed with code ${code}`));
          return;
        }
        resolve(output);
      });
    });
  }

  public async read(input: FileReadInput): Promise<FileReadOutput> {
    fileReadInputSchema.parse(input);

    const content = await this.execCommand(['cat', input.file_path]);

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

    return new Promise<FileWriteOutput>((resolve, reject) => {
      // Escape single quotes by replacing ' with '\''
      const escapedContent = input.content.replace(/'/g, "'\\''");
      // Use printf %s to write content without adding newlines
      const command = `printf '%s' '${escapedContent}' > ${JSON.stringify(input.file_path)}`;

      const process = spawn('docker', [
        'exec',
        '-i',
        this.container,
        this.shell,
        '-c',
        command,
      ]);

      let errorOutput = '';

      process.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      process.on('error', (err: unknown) => {
        reject(err);
      });

      process.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new Error(errorOutput || `Command failed with code ${code}`));
          return;
        }
        resolve({
          content: input.content,
        });
      });
    });
  }

  /**
   * Edits a file by replacing text and generates a unified diff
   */
  public async edit(input: FileEditInput): Promise<FileEditOutput> {
    fileEditInputSchema.parse(input);

    const oldContent = await this.execCommand(['cat', input.file_path]);

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

    await this.write({ file_path: input.file_path, content: newContent });

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
