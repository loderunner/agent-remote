import { spawn } from 'node:child_process';

import type { GlobInput, GlobOutput } from '@agent-remote/core';
import { globInputSchema } from '@agent-remote/core';
import { minimatch } from 'minimatch';

export class GlobTool {
  constructor(private readonly container: string) {}

  /**
   * Searches for files matching a glob pattern
   * Uses find command with local minimatch filtering for reliable cross-platform behavior
   *
   * When include_hidden is true:
   * - Wildcards match hidden files/directories
   * - Recurses into hidden subdirectories
   */
  public async glob(input: GlobInput): Promise<GlobOutput> {
    globInputSchema.parse(input);

    const isRecursive = input.pattern.includes('**');
    const hasPathSeparator = input.pattern.includes('/');

    // Build find command - recurse if pattern has ** or contains path separators
    let command = `find ${JSON.stringify(input.base_path)} -mindepth 1`;
    if (!isRecursive && !hasPathSeparator) {
      // Only search one level deep for simple patterns like *.txt
      command += ' -maxdepth 1';
    }

    return new Promise<GlobOutput>((resolve, reject) => {
      const process = spawn('docker', [
        'exec',
        '-i',
        this.container,
        'sh',
        '-c',
        command,
      ]);

      let output = '';

      process.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      process.on('error', (err: unknown) => {
        reject(err);
      });

      process.on('close', () => {
        output = output.trim();
        const allFiles =
          output === '' ? [] : output.split('\n').filter((f) => f.length > 0);

        // Filter files using minimatch
        // Convert absolute paths to relative for matching
        // Note: dot option controls whether wildcards match hidden files
        const matches = allFiles.filter((filePath) => {
          const relativePath = filePath.startsWith(input.base_path)
            ? filePath.slice(input.base_path.length + 1)
            : filePath;
          return minimatch(relativePath, input.pattern, {
            matchBase: false,
            dot: input.include_hidden ?? false,
          });
        });

        resolve({
          matches,
          count: matches.length,
        });
      });
    });
  }
}


