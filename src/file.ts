import { StructuredPatch, structuredPatch } from 'diff';
import { SFTPWrapper } from 'ssh2';
import z, { ZodType } from 'zod';

export type FileReadInput = {
  /**
   * The absolute path to the file to read
   */
  file_path: string;
  /**
   * The line number to start reading from. Only provide if the file is too large to read at once
   */
  offset?: number;
  /**
   * The number of lines to read. Only provide if the file is too large to read at once.
   */
  limit?: number;
};

export const fileReadInputSchema = z.object({
  file_path: z.string().describe('The absolute path to the file to read'),
  offset: z
    .number()
    .optional()
    .describe(
      'The line number to start reading from. Only provide if the file is too large to read at once',
    ),
  limit: z
    .number()
    .optional()
    .describe(
      'The number of lines to read. Only provide if the file is too large to read at once.',
    ),
}) satisfies ZodType<FileReadInput>;

export type FileReadOutput = {
  /**
   * The content of the file
   */
  content: string;
  /**
   * The number of lines read from the file
   */
  numLines: number;
  /**
   * The line number in the file that the reading started from
   */
  startLine: number;
  /**
   * The total number of lines in the file
   */
  totalLines: number;
};

export type FileWriteInput = {
  /**
   * The absolute path to the file to write (must be absolute, not relative)
   */
  file_path: string;
  /**
   * The content to write to the file
   */
  content: string;
};

export const fileWriteInputSchema = z.object({
  file_path: z
    .string()
    .describe(
      'The absolute path to the file to write (must be absolute, not relative)',
    ),
  content: z.string().describe('The content to write to the file'),
}) satisfies ZodType<FileWriteInput>;

export type FileWriteOutput = {
  /**
   * The content of the file
   */
  content: string;
};

export type FileEditInput = {
  /**
   * The absolute path to the file to modify
   */
  file_path: string;
  /**
   * The text to replace
   */
  old_string: string;
  /**
   * The text to replace it with (must be different from old_string)
   */
  new_string: string;
  /**
   * Replace all occurences of old_string (default false)
   */
  replace_all?: boolean;
};

export const fileEditInputSchema = z.object({
  file_path: z.string().describe('The absolute path to the file to modify'),
  old_string: z.string().describe('The text to replace'),
  new_string: z
    .string()
    .describe(
      'The text to replace it with (must be different from old_string)',
    ),
  replace_all: z
    .boolean()
    .optional()
    .describe('Replace all occurences of old_string (default false)'),
}) satisfies ZodType<FileEditInput>;

export type FileEditOutput = {
  /**
   * The number of replacements made
   */
  replacements: number;
  /**
   * Structured unified diff patch
   */
  diff: StructuredPatch;
};

export class FileTool {
  constructor(private readonly sftp: SFTPWrapper) {}

  public async read(input: FileReadInput): Promise<FileReadOutput> {
    const content = await new Promise<string>((resolve, reject) => {
      this.sftp.readFile(input.file_path, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data.toString());
      });
    });

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
    await new Promise<void>((resolve, reject) => {
      this.sftp.writeFile(input.file_path, input.content, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    return {
      content: input.content,
    };
  }

  /**
   * Edits a file by replacing text and generates a unified diff
   */
  public async edit(input: FileEditInput): Promise<FileEditOutput> {
    // Read the file content
    const oldContent = await new Promise<string>((resolve, reject) => {
      this.sftp.readFile(input.file_path, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data.toString());
      });
    });

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

    // Write back the modified content
    await new Promise<void>((resolve, reject) => {
      this.sftp.writeFile(input.file_path, newContent, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

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
