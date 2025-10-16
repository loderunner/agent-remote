import { minimatch } from 'minimatch';
import { Client } from 'ssh2';
import z, { ZodType } from 'zod';

export type GlobInput = {
  /**
   * The absolute base path to search from
   */
  base_path: string;
  /**
   * The glob pattern to match files against
   */
  pattern: string;
};

export const globInputSchema = z.object({
  base_path: z.string().describe('The absolute base path to search from'),
  pattern: z.string().describe('The glob pattern to match files against'),
}) satisfies ZodType<GlobInput>;

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

export class GlobTool {
  constructor(private readonly client: Client) {}

  /**
   * Searches for files matching a glob pattern
   * Uses find command with local minimatch filtering for reliable cross-platform behavior
   *
   * Hidden file behavior:
   * - Wildcards never match hidden files/directories (starting with .)
   * - Does not recurse into hidden subdirectories
   * - Can list entries of explicitly specified hidden directories (e.g., .config/*)
   */
  public async glob(input: GlobInput): Promise<GlobOutput> {
    const isRecursive = input.pattern.includes('**');
    const hasPathSeparator = input.pattern.includes('/');

    // Build find command - recurse if pattern has ** or contains path separators
    let command = `find ${JSON.stringify(input.base_path)} -mindepth 1`;
    if (!isRecursive && !hasPathSeparator) {
      // Only search one level deep for simple patterns like *.txt
      command += ' -maxdepth 1';
    }

    return new Promise<GlobOutput>((resolve, reject) => {
      this.client.exec(command, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }

        let output = '';
        channel.on('data', (data: Buffer) => {
          output += data.toString();
        });

        channel.on('error', (err: unknown) => {
          reject(err);
        });

        channel.on('close', () => {
          output = output.trim();
          const allFiles =
            output === '' ? [] : output.split('\n').filter((f) => f.length > 0);

          // Filter files using minimatch
          // Convert absolute paths to relative for matching
          // Note: dot: false ensures wildcards don't match hidden files
          const matches = allFiles.filter((filePath) => {
            const relativePath = filePath.startsWith(input.base_path)
              ? filePath.slice(input.base_path.length + 1)
              : filePath;
            return minimatch(relativePath, input.pattern, {
              matchBase: false,
            });
          });

          resolve({
            matches,
            count: matches.length,
          });
        });
      });
    });
  }
}
