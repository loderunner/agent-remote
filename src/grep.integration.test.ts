import { Client } from 'ssh2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GrepTool } from './grep';

describe('Integration Tests', () => {
  describe('GrepTool', () => {
    let client: Client;
    let grepTool: GrepTool;

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

      grepTool = new GrepTool(client);
    });

    afterAll(() => {
      client.end();
      client.destroy();
    });

    describe('Output Mode: files_with_matches (default)', () => {
      it('should find files containing a pattern', async () => {
        const path = '/home/dev/fixtures';
        const result = await grepTool.grep({
          pattern: 'ERROR',
          path,
        });

        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.numFiles).toBeGreaterThan(0);
          expect(result.filenames.length).toBe(result.numFiles);
          expect(result.filenames).toContain(`${path}/log.txt`);
          expect(result.filenames).toContain(`${path}/mixed-case.txt`);
        }
      });

      it('should find files with TODO pattern', async () => {
        const path = '/home/dev/fixtures';
        const result = await grepTool.grep({
          pattern: 'TODO',
          path,
        });

        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.numFiles).toBeGreaterThan(0);
          expect(result.filenames.length).toBe(result.numFiles);
          expect(result.filenames).toContain(`${path}/docs/README.md`);
          expect(result.filenames).toContain(`${path}/docs/API.md`);
          expect(result.filenames).toContain(`${path}/code/app.js`);
        }
      });

      it('should filter files by glob pattern', async () => {
        const result = await grepTool.grep({
          pattern: 'TODO',
          path: '/home/dev/fixtures',
          glob: '*.md',
        });

        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.numFiles).toBeGreaterThan(0);
          expect(result.filenames.length).toBe(result.numFiles);
          for (const filename of result.filenames) {
            expect(filename).toMatch(/\.md$/);
          }
        }
      });

      it('should limit number of results with head_limit', async () => {
        const pattern = 'ERROR';
        const path = '/home/dev/fixtures';

        let result = await grepTool.grep({
          pattern,
          path,
        });

        let firstFilename: string;
        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.filenames.length).toBeGreaterThan(1);
          firstFilename = result.filenames[0];
        }

        result = await grepTool.grep({
          pattern,
          path,
          head_limit: 1,
        });

        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.numFiles).toBe(1);
          expect(result.filenames.length).toBe(result.numFiles);
          expect(result.filenames).toContain(firstFilename!);
        }
      });

      it('should find files in nested directories', async () => {
        const path = '/home/dev/fixtures/nested';
        const result = await grepTool.grep({
          pattern: 'ERROR',
          path,
        });

        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.numFiles).toBeGreaterThan(0);
          expect(result.filenames.length).toBe(result.numFiles);
          expect(result.filenames).toContain(`${path}/deep/nested-file.txt`);
        }
      });

      it('should return no files when pattern not found', async () => {
        const result = await grepTool.grep({
          pattern: 'ThisPatternDoesNotExistAnywhere12345',
          path: '/home/dev/fixtures',
        });

        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.numFiles).toBe(0);
          expect(result.filenames.length).toBe(result.numFiles);
          expect(result.filenames).toEqual([]);
        }
      });
    });

    describe('Output Mode: content', () => {
      it('should return matching lines in content mode', async () => {
        const result = await grepTool.grep({
          pattern: 'Hello World',
          path: '/home/dev/fixtures/simple.txt',
          output_mode: 'content',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.content).toContain('Hello World');
          expect(result.numLines).toBeGreaterThan(0);
        }
      });

      it('should show line numbers with -n flag', async () => {
        const result = await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev/fixtures/log.txt',
          output_mode: 'content',
          '-n': true,
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          const lines = result.content.split('\n');
          for (const line of lines) {
            expect(line).toMatch(/^\d+:/);
            expect(line).toContain('ERROR');
          }
        }
      });

      it('should show context lines after match with -A', async () => {
        const result = await grepTool.grep({
          pattern: 'WARNING.*High memory',
          path: '/home/dev/fixtures/log.txt',
          output_mode: 'content',
          '-A': 2,
          '-n': true,
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBeGreaterThanOrEqual(3);
          const lines = result.content.split('\n');
          expect(lines.length).toBe(result.numLines);

          expect(lines[0]).toMatch(/^\d+:/);
          expect(lines[0]).toContain('WARNING');
          expect(lines[0]).toContain('High memory');
          const lineNumber = Number.parseInt(lines[0].split(':')[0]);
          expect(lines[1]).toStartWith(`${lineNumber + 1}-`);
          expect(lines[2]).toStartWith(`${lineNumber + 2}-`);
        }
      });

      it('should show context lines before match with -B', async () => {
        const result = await grepTool.grep({
          pattern: 'Connection timeout',
          path: '/home/dev/fixtures/log.txt',
          output_mode: 'content',
          '-B': 2,
          '-n': true,
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBeGreaterThanOrEqual(3);
          const lines = result.content.split('\n');
          expect(lines.length).toBe(result.numLines);

          expect(lines[2]).toMatch(/^\d+:/);
          expect(lines[2]).toContain('Connection timeout');
          const lineNumber = Number.parseInt(lines[2].split(':')[0]);
          expect(lines[1]).toStartWith(`${lineNumber - 1}-`);
          expect(lines[0]).toStartWith(`${lineNumber - 2}-`);
        }
      });

      it('should show context lines around match with -C', async () => {
        const result = await grepTool.grep({
          pattern: 'Database connection lost',
          path: '/home/dev/fixtures/log.txt',
          output_mode: 'content',
          '-C': 2,
          '-n': true,
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBeGreaterThanOrEqual(5);
          const lines = result.content.split('\n');
          expect(lines.length).toBe(result.numLines);

          expect(lines[2]).toMatch(/^\d+:/);
          expect(lines[2]).toContain('Database connection lost');
          const lineNumber = Number.parseInt(lines[2].split(':')[0]);

          expect(lines[0]).toStartWith(`${lineNumber - 2}-`);
          expect(lines[1]).toStartWith(`${lineNumber - 1}-`);
          expect(lines[3]).toStartWith(`${lineNumber + 1}-`);
          expect(lines[4]).toStartWith(`${lineNumber + 2}-`);
        }
      });

      it('should show file name with -n flag when multiple files match', async () => {
        const result = await grepTool.grep({
          pattern: 'TODO',
          path: '/home/dev/fixtures',
          output_mode: 'content',
          '-n': true,
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBeGreaterThan(0);
          const lines = result.content.split('\n');
          expect(lines.length).toBe(result.numLines);
          for (const line of lines) {
            expect(line).toContain('TODO');
            expect(line).toMatch(/^[^:]+:\d+:/);
          }
          const filenames = new Set(lines.map((line) => line.split(':')[0]));
          expect(filenames.size).toBeGreaterThan(1);
        }
      });

      it('should limit output lines with head_limit', async () => {
        let result = await grepTool.grep({
          pattern: 'INFO',
          path: '/home/dev/fixtures/log.txt',
          output_mode: 'content',
        });

        if (result.mode === 'content') {
          expect(result.numLines).toBeGreaterThan(2);
          const lines = result.content.split('\n');
          expect(lines.length).toBe(result.numLines);
        }

        result = await grepTool.grep({
          pattern: 'INFO',
          path: '/home/dev/fixtures/log.txt',
          output_mode: 'content',
          head_limit: 2,
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBeLessThanOrEqual(2);
          const lines = result.content.split('\n');
          expect(lines.length).toBe(result.numLines);
          for (const line of lines) {
            expect(line).toContain('INFO');
          }
        }
      });

      it('should search across multiple files in directory', async () => {
        const result = await grepTool.grep({
          pattern: 'TODO',
          path: '/home/dev/fixtures',
          output_mode: 'content',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBeGreaterThan(2);
          const lines = result.content.split('\n');
          expect(lines.length).toBe(result.numLines);
          for (const line of lines) {
            expect(line).toContain('TODO');
          }
          const filenames = new Set(lines.map((line) => line.split(':')[0]));
          expect(filenames.size).toBeGreaterThan(1);
        }
      });

      it('should find pattern in nested directories', async () => {
        const path = '/home/dev/fixtures/nested';
        const result = await grepTool.grep({
          pattern: 'deeply nested',
          path,
          output_mode: 'content',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBeGreaterThan(0);
          const lines = result.content.split('\n');
          expect(lines.length).toBe(result.numLines);
          for (const line of lines) {
            expect(line).toContain('deeply nested');
            expect(line).toStartWith(`${path}/deep`);
          }
        }
      });

      it('should work with glob filter in content mode', async () => {
        let result = await grepTool.grep({
          pattern: 'express',
          path: '/home/dev/fixtures',
          output_mode: 'content',
          glob: '*.js',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.content).toContain('express');
        }

        result = await grepTool.grep({
          pattern: 'express',
          path: '/home/dev/fixtures',
          output_mode: 'content',
          glob: '*.py',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBe(0);
          expect(result.content).toBe('');
        }
      });
    });

    describe('Output Mode: count', () => {
      it('should count matching lines across files', async () => {
        const result = await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev/fixtures',
          output_mode: 'count',
        });

        expect(result.mode).toBe('count');
        if (result.mode === 'count') {
          expect(result.numMatches).toBeGreaterThan(0);
        }
      });

      it('should count matches in single file', async () => {
        const result = await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev/fixtures/log.txt',
          output_mode: 'count',
        });

        expect(result.mode).toBe('count');
        if (result.mode === 'count') {
          expect(result.numMatches).toBeGreaterThan(1);
        }
      });

      it('should return 0 count when pattern not found', async () => {
        const result = await grepTool.grep({
          pattern: 'ThisPatternDoesNotExistAnywhere12345',
          path: '/home/dev/fixtures',
          output_mode: 'count',
        });

        expect(result.mode).toBe('count');
        if (result.mode === 'count') {
          expect(result.numMatches).toBe(0);
        }
      });

      it('should count matches with glob filter', async () => {
        let result = await grepTool.grep({
          pattern: 'TODO',
          path: '/home/dev/fixtures',
          output_mode: 'count',
          glob: '*.md',
        });

        expect(result.mode).toBe('count');
        if (result.mode === 'count') {
          expect(result.numMatches).toBeGreaterThan(0);
        }

        result = await grepTool.grep({
          pattern: 'express',
          path: '/home/dev/fixtures',
          output_mode: 'count',
          glob: '*.md',
        });

        expect(result.mode).toBe('count');
        if (result.mode === 'count') {
          expect(result.numMatches).toBe(0);
        }
      });

      it('should count matches with head_limit', async () => {
        let result = await grepTool.grep({
          pattern: 'TODO',
          path: '/home/dev/fixtures',
          output_mode: 'count',
        });

        expect(result.mode).toBe('count');
        if (result.mode === 'count') {
          expect(result.numMatches).toBeGreaterThan(1);
        }

        result = await grepTool.grep({
          pattern: 'TODO',
          path: '/home/dev/fixtures',
          output_mode: 'count',
          head_limit: 1,
        });

        expect(result.mode).toBe('count');
        if (result.mode === 'count') {
          expect(result.numMatches).toBeLessThanOrEqual(1);
        }
      });
    });

    describe('Case Sensitivity', () => {
      it('should be case-sensitive by default', async () => {
        const result = await grepTool.grep({
          pattern: 'error',
          path: '/home/dev/fixtures/mixed-case.txt',
          output_mode: 'content',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.content).toContain('error can also be lowercase');
          expect(result.content).not.toContain('ERROR is in capitals');
        }
      });

      it('should be case-insensitive with -i flag', async () => {
        const result = await grepTool.grep({
          pattern: 'error',
          path: '/home/dev/fixtures/mixed-case.txt',
          output_mode: 'content',
          '-i': true,
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.content).toContain('ERROR');
          expect(result.content).toContain('error');
        }
      });

      it('should find case-insensitive matches across files', async () => {
        const result = await grepTool.grep({
          pattern: 'error',
          path: '/home/dev/fixtures',
          '-i': true,
        });

        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.numFiles).toBeGreaterThan(0);
          expect(result.filenames).toSatisfyAny((f: string) =>
            f.includes('log.txt'),
          );
          expect(result.filenames).toSatisfyAny((f: string) =>
            f.includes('mixed-case.txt'),
          );
        }
      });
    });

    describe('Special Patterns', () => {
      it('should handle regex patterns', async () => {
        const result = await grepTool.grep({
          pattern: '\\[.*\\] ERROR:',
          path: '/home/dev/fixtures/log.txt',
          output_mode: 'content',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.content).toContain('ERROR:');
          expect(result.numLines).toBeGreaterThan(0);
        }
      });

      it('should match beginning of line', async () => {
        const path = '/home/dev/fixtures/simple.txt';
        const result = await grepTool.grep({
          pattern: '^Line',
          path,
          output_mode: 'content',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.content).toStartWith(`Line`);
          expect(result.numLines).toBeGreaterThan(0);
        }
      });

      it('should match end of line', async () => {
        const result = await grepTool.grep({
          pattern: 'here$',
          path: '/home/dev/fixtures/simple.txt',
          output_mode: 'content',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.content).toEndWith('here');
        }
      });

      it('should handle patterns with special characters', async () => {
        const result = await grepTool.grep({
          pattern: 'api/users',
          path: '/home/dev/fixtures',
          output_mode: 'content',
          glob: '*.js',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.content).toContain('api/users');
        }
      });
    });

    describe('Empty Results', () => {
      it('should handle empty directory', async () => {
        const result = await grepTool.grep({
          pattern: 'anything',
          path: '/home/dev/fixtures/empty',
        });

        expect(result.mode).toBe('files_with_matches');
        if (result.mode === 'files_with_matches') {
          expect(result.numFiles).toBe(0);
          expect(result.filenames).toEqual([]);
        }
      });

      it('should return empty content when no matches in content mode', async () => {
        const result = await grepTool.grep({
          pattern: 'ThisPatternDoesNotExistAnywhere12345',
          path: '/home/dev/fixtures/simple.txt',
          output_mode: 'content',
        });

        expect(result.mode).toBe('content');
        if (result.mode === 'content') {
          expect(result.numLines).toBe(0);
          expect(result.content).toBe('');
        }
      });

      it('should return 0 when no matches in count mode', async () => {
        const result = await grepTool.grep({
          pattern: 'ThisPatternDoesNotExistAnywhere12345',
          path: '/home/dev/fixtures/simple.txt',
          output_mode: 'count',
        });

        expect(result.mode).toBe('count');
        if (result.mode === 'count') {
          expect(result.numMatches).toBe(0);
        }
      });
    });
  });
});
