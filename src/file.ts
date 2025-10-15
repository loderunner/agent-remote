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
}
