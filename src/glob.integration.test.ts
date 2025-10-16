import { Client } from 'ssh2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GlobTool } from './glob';

describe('Integration Tests', () => {
  describe('GlobTool', () => {
    let client: Client;
    let globTool: GlobTool;

    beforeAll(async () => {
      client = new Client();
      await new Promise<void>((resolve, reject) => {
        client.on('ready', () => {
          resolve();
        });
        client.on('error', (err) => {
          reject(err);
        });
        client.connect({
          host: 'localhost',
          port: 2222,
          username: 'dev',
          password: 'dev',
        });
      });

      globTool = new GlobTool(client);
    });

    afterAll(() => {
      client.end();
    });

    describe('Simple wildcards', () => {
      it('should match all files with *.txt pattern', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '*.txt',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/log.txt',
          '/home/dev/fixtures/mixed-case.txt',
          '/home/dev/fixtures/simple.txt',
        ]);
        expect(result.count).toBe(3);
      });

      it('should return empty array when no matches', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '*.nonexistent',
        });

        expect(result.matches).toEqual([]);
        expect(result.count).toBe(0);
      });
    });

    describe('Recursive patterns (globstar **)', () => {
      it('should match all .txt files recursively with **/*.txt', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '**/*.txt',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/log.txt',
          '/home/dev/fixtures/mixed-case.txt',
          '/home/dev/fixtures/simple.txt',
          '/home/dev/fixtures/nested/deep/nested-file.txt',
          '/home/dev/fixtures/hidden/visible1.txt',
          '/home/dev/fixtures/hidden/regular-dir/visible.txt',
        ]);
        expect(result.count).toBe(6);
      });

      it('should match all files recursively with **/*', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '**/*',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/code',
          '/home/dev/fixtures/code/app.js',
          '/home/dev/fixtures/code/config.py',
          '/home/dev/fixtures/code/utils.ts',
          '/home/dev/fixtures/docs',
          '/home/dev/fixtures/docs/API.md',
          '/home/dev/fixtures/docs/README.md',
          '/home/dev/fixtures/empty',
          '/home/dev/fixtures/log.txt',
          '/home/dev/fixtures/mixed-case.txt',
          '/home/dev/fixtures/nested',
          '/home/dev/fixtures/nested/deep',
          '/home/dev/fixtures/nested/deep/nested-file.txt',
          '/home/dev/fixtures/simple.txt',
          '/home/dev/fixtures/hidden',
          '/home/dev/fixtures/hidden/visible1.txt',
          '/home/dev/fixtures/hidden/visible2.md',
          '/home/dev/fixtures/hidden/regular-dir',
          '/home/dev/fixtures/hidden/regular-dir/visible.txt',
        ]);
        expect(result.count).toBe(19);
      });

      it('should match files in nested directories', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: 'nested/**/*.txt',
        });

        expect(result.matches).toContain(
          '/home/dev/fixtures/nested/deep/nested-file.txt',
        );
        expect(result.count).toBe(1);
      });
    });

    describe('Brace expansion', () => {
      it('should match multiple extensions with {*.js,*.py}', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/code',
          pattern: '{*.js,*.py}',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/code/app.js',
          '/home/dev/fixtures/code/config.py',
        ]);
        expect(result.count).toBe(2);
      });

      it('should match multiple extensions with *.{js,ts,py}', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/code',
          pattern: '*.{js,ts,py}',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/code/app.js',
          '/home/dev/fixtures/code/utils.ts',
          '/home/dev/fixtures/code/config.py',
        ]);
        expect(result.count).toBe(3);
      });

      it('should work with recursive patterns **/*.{js,ts}', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '**/*.{js,ts}',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/code/app.js',
          '/home/dev/fixtures/code/utils.ts',
        ]);
        expect(result.count).toBe(2);
      });
    });

    describe('Directory matching', () => {
      it('should match directories with wildcard pattern', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '*',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/code',
          '/home/dev/fixtures/docs',
          '/home/dev/fixtures/nested',
          '/home/dev/fixtures/empty',
          '/home/dev/fixtures/log.txt',
          '/home/dev/fixtures/mixed-case.txt',
          '/home/dev/fixtures/simple.txt',
          '/home/dev/fixtures/hidden',
        ]);
      });

      it('should match nested directories', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: 'nested/*',
        });

        expect(result.matches).toContain('/home/dev/fixtures/nested/deep');
        expect(result.count).toBe(1);
      });

      it('should match all nested paths recursively', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/nested',
          pattern: '**/*',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/nested/deep',
          '/home/dev/fixtures/nested/deep/nested-file.txt',
        ]);
        expect(result.count).toBe(2);
      });
    });

    describe('Special patterns', () => {
      it('should match files with specific prefix', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: 'log*',
        });

        expect(result.matches).toContain('/home/dev/fixtures/log.txt');
        expect(result.count).toBe(1);
      });

      it('should match files with specific suffix', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '*-case.txt',
        });

        expect(result.matches).toContain('/home/dev/fixtures/mixed-case.txt');
        expect(result.count).toBe(1);
      });

      it('should handle empty directories', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/empty',
          pattern: '*',
        });

        expect(result.matches).toEqual([]);
        expect(result.count).toBe(0);
      });
    });

    describe('Hidden files and directories', () => {
      it('should not match hidden files with * wildcard', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/hidden',
          pattern: '*',
        });

        // Should only match visible files and directories, not hidden ones
        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/hidden/visible1.txt',
          '/home/dev/fixtures/hidden/visible2.md',
          '/home/dev/fixtures/hidden/regular-dir',
        ]);
        expect(result.count).toBe(3);
      });

      it('should not match hidden files with *.txt pattern', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/hidden',
          pattern: '*.txt',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/hidden/visible1.txt',
        ]);
        expect(result.count).toBe(1);
      });

      it('should not recurse into hidden directories with **/*', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/hidden',
          pattern: '**/*',
        });

        // Should find files in regular-dir but not in .hidden-dir or .hidden-subdir
        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/hidden/visible1.txt',
          '/home/dev/fixtures/hidden/visible2.md',
          '/home/dev/fixtures/hidden/regular-dir',
          '/home/dev/fixtures/hidden/regular-dir/visible.txt',
        ]);
        expect(result.count).toBe(4);
      });

      it('should not match hidden files in subdirectories with **/*.txt', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/hidden',
          pattern: '**/*.txt',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/hidden/visible1.txt',
          '/home/dev/fixtures/hidden/regular-dir/visible.txt',
        ]);
        expect(result.count).toBe(2);
      });

      it('can list entries of explicitly specified hidden directory', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/hidden/.hidden-dir',
          pattern: '*',
        });

        // When base_path is a hidden directory, we can list its non-hidden contents
        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/hidden/.hidden-dir/visible-in-hidden.txt',
          '/home/dev/fixtures/hidden/.hidden-dir/subdir',
        ]);
        expect(result.count).toBe(2);
      });

      it('can list all entries of hidden directory recursively', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/hidden/.hidden-dir',
          pattern: '**/*',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/hidden/.hidden-dir/visible-in-hidden.txt',
          '/home/dev/fixtures/hidden/.hidden-dir/subdir',
          '/home/dev/fixtures/hidden/.hidden-dir/subdir/nested-visible.txt',
        ]);
        expect(result.count).toBe(3);
      });

      it('can match files in hidden directory with pattern', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/hidden/.hidden-dir',
          pattern: '*.txt',
        });

        expect(result.matches).toIncludeSameMembers([
          '/home/dev/fixtures/hidden/.hidden-dir/visible-in-hidden.txt',
        ]);
        expect(result.count).toBe(1);
      });

      it('should not match hidden files even in explicitly specified hidden directory', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures/hidden/.hidden-dir',
          pattern: '*',
        });

        // Should not include .hidden-in-hidden.txt
        expect(result.matches).not.toContain(
          '/home/dev/fixtures/hidden/.hidden-dir/.hidden-in-hidden.txt',
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle patterns with no matches', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: 'does-not-exist-*.xyz',
        });

        expect(result.matches).toEqual([]);
        expect(result.count).toBe(0);
      });

      it('should handle recursive patterns with no matches', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '**/*.xyz',
        });

        expect(result.matches).toEqual([]);
        expect(result.count).toBe(0);
      });

      it('should match single file exactly', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: 'log.txt',
        });

        expect(result.matches).toEqual(['/home/dev/fixtures/log.txt']);
        expect(result.count).toBe(1);
      });

      it('should handle complex nested patterns', async () => {
        const result = await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: 'nested/**/nested-*.txt',
        });

        expect(result.matches).toContain(
          '/home/dev/fixtures/nested/deep/nested-file.txt',
        );
        expect(result.count).toBe(1);
      });
    });
  });
});
