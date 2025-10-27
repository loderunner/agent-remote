import z, { ZodType } from 'zod';

/**
 * Input for grep search
 */
export type GrepInput = {
  /**
   * The regular expression pattern to search for in file contents
   */
  pattern: string;
  /**
   * File or directory to search in (grep PATH).
   */
  path: string;
  /**
   * Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to grep --include
   */
  glob?: string;
  /**
   * Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".
   */
  output_mode?: 'content' | 'files_with_matches' | 'count';
  /**
   * Number of lines to show before each match (grep -B). Requires output_mode: "content", ignored otherwise.
   */
  '-B'?: number;
  /**
   * Number of lines to show after each match (grep -A). Requires output_mode: "content", ignored otherwise.
   */
  '-A'?: number;
  /**
   * Number of lines to show before and after each match (grep -C). Requires output_mode: "content", ignored otherwise.
   */
  '-C'?: number;
  /**
   * Show line numbers in output (grep -n). Requires output_mode: "content", ignored otherwise.
   */
  '-n'?: boolean;
  /**
   * Case insensitive search (grep -i)
   */
  '-i'?: boolean;
  /**
   * Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). When unspecified, shows all results from grep.
   */
  head_limit?: number;
};

export const grepInputSchema = z.object({
  pattern: z
    .string()
    .describe('The regular expression pattern to search for in file contents'),
  path: z.string().describe('File or directory to search in (grep PATH)'),
  glob: z
    .string()
    .optional()
    .describe(
      'Glob pattern to filter files (e.g. "*.js", "*test*") - maps to grep --include',
    ),
  output_mode: z
    .enum(['content', 'files_with_matches', 'count'])
    .optional()
    .describe(
      'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches"',
    ),
  '-B': z
    .number()
    .optional()
    .describe(
      'Number of lines to show before each match (grep -B). Requires output_mode: "content", ignored otherwise.',
    ),
  '-A': z
    .number()
    .optional()
    .describe(
      'Number of lines to show after each match (grep -A). Requires output_mode: "content", ignored otherwise.',
    ),
  '-C': z
    .number()
    .optional()
    .describe(
      'Number of lines to show before and after each match (grep -C). Requires output_mode: "content", ignored otherwise.',
    ),
  '-n': z
    .boolean()
    .optional()
    .describe(
      'Show line numbers in output (grep -n). Requires output_mode: "content", ignored otherwise.',
    ),
  '-i': z.boolean().optional().describe('Case insensitive search (grep -i)'),
  head_limit: z
    .number()
    .optional()
    .describe(
      'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). When unspecified, shows all results from grep.',
    ),
}) satisfies ZodType<GrepInput>;

/**
 * Output from grep search (discriminated union based on mode)
 */
export type GrepOutput =
  | {
      mode: 'content';
      content: string;
      numLines: number;
    }
  | {
      mode: 'files_with_matches';
      numFiles: number;
      filenames: string[];
    }
  | {
      mode: 'count';
      numMatches: number;
    };
