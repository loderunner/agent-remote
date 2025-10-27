import z, { ZodType } from 'zod';

/**
 * Input for glob file search
 */
export type GlobInput = {
  /**
   * The absolute base path to search from
   */
  base_path: string;
  /**
   * The glob pattern to match files against
   */
  pattern: string;
  /**
   * Whether to include hidden files (starting with `.`) in the results
   * Defaults to false
   */
  include_hidden?: boolean;
};

export const globInputSchema = z.object({
  base_path: z.string().describe('The absolute base path to search from'),
  pattern: z.string().describe('The glob pattern to match files against'),
  include_hidden: z
    .boolean()
    .optional()
    .describe(
      'Whether to include hidden files (starting with `.`) in the results. Defaults to false',
    ),
}) satisfies ZodType<GlobInput>;

/**
 * Output from glob file search
 */
export type GlobOutput = {
  /**
   * List of matching file paths
   */
  matches: string[];
  /**
   * Number of matches found
   */
  count: number;
};
