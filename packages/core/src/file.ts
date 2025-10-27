import z, { ZodType } from 'zod';

/**
 * Input for reading a file
 */
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

/**
 * Output from reading a file
 */
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

/**
 * Input for writing a file
 */
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

/**
 * Output from writing a file
 */
export type FileWriteOutput = {
  /**
   * The content of the file
   */
  content: string;
};

/**
 * Input for editing a file
 */
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

/**
 * Structured unified diff patch
 * This type matches the output from the 'diff' library's structuredPatch function
 */
export type StructuredPatch = {
  oldFileName: string;
  newFileName: string;
  oldHeader: string | undefined;
  newHeader: string | undefined;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }>;
  index?: string;
};

/**
 * Output from editing a file
 */
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
