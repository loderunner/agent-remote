import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RemoteInstance, RemoteProvider, TestEnvironment } from '../provider';

/**
 * Test suite for grep tool.
 * Tests pattern searching, output modes, filters, and regex support.
 *
 * @param provider - Remote provider implementation to test
 */
export function grepSuite(provider: RemoteProvider) {
  describe(`grep tool [${provider.name}]`, () => {
    let remote: RemoteInstance;
    let env: TestEnvironment;

    beforeAll(async () => {
      remote = await provider.connect();
      env = provider.getTestEnvironment();
    });

    afterAll(async () => {
      await provider.disconnect(remote);
    });

    describe('output mode: files_with_matches (default)', () => {
      it('should find files containing a pattern', async () => {
        const path = env.fixturesPath;
        const result = await remote.grep.handler({
          pattern: 'ERROR',
          path,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('files_with_matches');
        expect(result.structuredContent?.numFiles).toBeGreaterThan(0);
        expect(result.structuredContent?.filenames.length).toBe(
          result.structuredContent?.numFiles,
        );
        expect(result.structuredContent?.filenames).toContain(
          `${path}/log.txt`,
        );
        expect(result.structuredContent?.filenames).toContain(
          `${path}/mixed-case.txt`,
        );
      });

      it('should find files with TODO pattern', async () => {
        const path = env.fixturesPath;
        const result = await remote.grep.handler({
          pattern: 'TODO',
          path,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('files_with_matches');
        expect(result.structuredContent?.numFiles).toBeGreaterThan(0);
        expect(result.structuredContent?.filenames).toContain(
          `${path}/docs/README.md`,
        );
        expect(result.structuredContent?.filenames).toContain(
          `${path}/docs/API.md`,
        );
        expect(result.structuredContent?.filenames).toContain(
          `${path}/code/app.js`,
        );
      });

      it('should filter files by glob pattern', async () => {
        const result = await remote.grep.handler({
          pattern: 'TODO',
          path: env.fixturesPath,
          glob: '*.md',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('files_with_matches');
        expect(result.structuredContent?.numFiles).toBeGreaterThan(0);
        for (const filename of result.structuredContent!.filenames) {
          expect(filename).toMatch(/\.md$/);
        }
      });

      it('should limit number of results with head_limit', async () => {
        const pattern = 'ERROR';
        const path = env.fixturesPath;

        const fullResult = await remote.grep.handler({
          pattern,
          path,
        });

        expect(fullResult.isError).not.toBe(true);
        expect(fullResult.structuredContent?.mode).toBe('files_with_matches');
        expect(fullResult.structuredContent?.filenames.length).toBeGreaterThan(
          1,
        );

        const { filenames: fullFilenames } = fullResult.structuredContent!;
        const firstFilename = fullFilenames[0];

        const limitedResult = await remote.grep.handler({
          pattern,
          path,
          head_limit: 1,
        });

        expect(limitedResult.isError).not.toBe(true);
        expect(limitedResult.structuredContent?.mode).toBe('files_with_matches');
        expect(limitedResult.structuredContent?.numFiles).toBe(1);
        expect(limitedResult.structuredContent?.filenames).toContain(
          firstFilename,
        );
      });

      it('should find files in nested directories', async () => {
        const path = `${env.fixturesPath}/nested`;
        const result = await remote.grep.handler({
          pattern: 'ERROR',
          path,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('files_with_matches');
        expect(result.structuredContent?.numFiles).toBeGreaterThan(0);
        expect(result.structuredContent?.filenames).toContain(
          `${path}/deep/nested-file.txt`,
        );
      });

      it('should return no files when pattern not found', async () => {
        const result = await remote.grep.handler({
          pattern: 'ThisPatternDoesNotExistAnywhere12345',
          path: env.fixturesPath,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('files_with_matches');
        expect(result.structuredContent?.numFiles).toBe(0);
        expect(result.structuredContent?.filenames).toEqual([]);
      });
    });

    describe('output mode: content', () => {
      it('should return matching lines in content mode', async () => {
        const result = await remote.grep.handler({
          pattern: 'Hello World',
          path: `${env.fixturesPath}/simple.txt`,
          output_mode: 'content',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.content).toContain('Hello World');
        expect(result.structuredContent?.numLines).toBeGreaterThan(0);
      });

      it('should show line numbers with -n flag', async () => {
        const result = await remote.grep.handler({
          pattern: 'ERROR',
          path: `${env.fixturesPath}/log.txt`,
          output_mode: 'content',
          '-n': true,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');

        const lines = result.structuredContent!.content.split('\n');
        for (const line of lines) {
          expect(line).toMatch(/^\d+:/);
          expect(line).toContain('ERROR');
        }
      });

      it('should show context lines after match with -A', async () => {
        const result = await remote.grep.handler({
          pattern: 'WARNING.*High memory',
          path: `${env.fixturesPath}/log.txt`,
          output_mode: 'content',
          '-A': 2,
          '-n': true,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.numLines).toBeGreaterThanOrEqual(3);

        const lines = result.structuredContent!.content.split('\n');
        expect(lines.length).toBe(result.structuredContent?.numLines);

        expect(lines[0]).toMatch(/^\d+:/);
        expect(lines[0]).toContain('WARNING');
        expect(lines[0]).toContain('High memory');

        const lineNumber = Number.parseInt(lines[0].split(':')[0]);
        expect(lines[1]).toStartWith(`${lineNumber + 1}-`);
        expect(lines[2]).toStartWith(`${lineNumber + 2}-`);
      });

      it('should show context lines before match with -B', async () => {
        const result = await remote.grep.handler({
          pattern: 'Connection timeout',
          path: `${env.fixturesPath}/log.txt`,
          output_mode: 'content',
          '-B': 2,
          '-n': true,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.numLines).toBeGreaterThanOrEqual(3);

        const lines = result.structuredContent!.content.split('\n');
        expect(lines[2]).toMatch(/^\d+:/);
        expect(lines[2]).toContain('Connection timeout');

        const lineNumber = Number.parseInt(lines[2].split(':')[0]);
        expect(lines[1]).toStartWith(`${lineNumber - 1}-`);
        expect(lines[0]).toStartWith(`${lineNumber - 2}-`);
      });

      it('should show context lines around match with -C', async () => {
        const result = await remote.grep.handler({
          pattern: 'Database connection lost',
          path: `${env.fixturesPath}/log.txt`,
          output_mode: 'content',
          '-C': 2,
          '-n': true,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.numLines).toBeGreaterThanOrEqual(5);

        const lines = result.structuredContent!.content.split('\n');
        expect(lines[2]).toMatch(/^\d+:/);
        expect(lines[2]).toContain('Database connection lost');

        const lineNumber = Number.parseInt(lines[2].split(':')[0]);
        expect(lines[0]).toStartWith(`${lineNumber - 2}-`);
        expect(lines[1]).toStartWith(`${lineNumber - 1}-`);
        expect(lines[3]).toStartWith(`${lineNumber + 1}-`);
        expect(lines[4]).toStartWith(`${lineNumber + 2}-`);
      });

      it('should limit output lines with head_limit', async () => {
        const fullResult = await remote.grep.handler({
          pattern: 'INFO',
          path: `${env.fixturesPath}/log.txt`,
          output_mode: 'content',
        });

        expect(fullResult.isError).not.toBe(true);
        expect(fullResult.structuredContent?.mode).toBe('content');
        expect(fullResult.structuredContent?.numLines).toBeGreaterThan(2);

        const limitedResult = await remote.grep.handler({
          pattern: 'INFO',
          path: `${env.fixturesPath}/log.txt`,
          output_mode: 'content',
          head_limit: 2,
        });

        expect(limitedResult.isError).not.toBe(true);
        expect(limitedResult.structuredContent?.mode).toBe('content');
        expect(limitedResult.structuredContent?.numLines).toBeLessThanOrEqual(
          2,
        );
      });
    });

    describe('output mode: count', () => {
      it('should count matching lines across files', async () => {
        const result = await remote.grep.handler({
          pattern: 'ERROR',
          path: env.fixturesPath,
          output_mode: 'count',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('count');
        expect(result.structuredContent?.numMatches).toBeGreaterThan(0);
      });

      it('should count matches in single file', async () => {
        const result = await remote.grep.handler({
          pattern: 'ERROR',
          path: `${env.fixturesPath}/log.txt`,
          output_mode: 'count',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('count');
        expect(result.structuredContent?.numMatches).toBeGreaterThan(1);
      });

      it('should return 0 count when pattern not found', async () => {
        const result = await remote.grep.handler({
          pattern: 'ThisPatternDoesNotExistAnywhere12345',
          path: env.fixturesPath,
          output_mode: 'count',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('count');
        expect(result.structuredContent?.numMatches).toBe(0);
      });
    });

    describe('case sensitivity', () => {
      it('should be case-sensitive by default', async () => {
        const result = await remote.grep.handler({
          pattern: 'error',
          path: `${env.fixturesPath}/mixed-case.txt`,
          output_mode: 'content',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.content).toContain(
          'error can also be lowercase',
        );
        expect(result.structuredContent?.content).not.toContain(
          'ERROR is in capitals',
        );
      });

      it('should be case-insensitive with -i flag', async () => {
        const result = await remote.grep.handler({
          pattern: 'error',
          path: `${env.fixturesPath}/mixed-case.txt`,
          output_mode: 'content',
          '-i': true,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.content).toContain('ERROR');
        expect(result.structuredContent?.content).toContain('error');
      });
    });

    describe('special patterns', () => {
      it('should handle regex patterns', async () => {
        const result = await remote.grep.handler({
          pattern: '\\[.*\\] ERROR:',
          path: `${env.fixturesPath}/log.txt`,
          output_mode: 'content',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.content).toContain('ERROR:');
        expect(result.structuredContent?.numLines).toBeGreaterThan(0);
      });

      it('should match beginning of line', async () => {
        const path = `${env.fixturesPath}/simple.txt`;
        const result = await remote.grep.handler({
          pattern: '^Line',
          path,
          output_mode: 'content',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.content).toContain('Line');
        expect(result.structuredContent?.numLines).toBeGreaterThan(0);
      });

      it('should match end of line', async () => {
        const result = await remote.grep.handler({
          pattern: 'here$',
          path: `${env.fixturesPath}/simple.txt`,
          output_mode: 'content',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.content).toContain('here');
      });
    });

    describe('empty results', () => {
      it('should handle empty directory', async () => {
        const result = await remote.grep.handler({
          pattern: 'anything',
          path: `${env.fixturesPath}/empty`,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('files_with_matches');
        expect(result.structuredContent?.numFiles).toBe(0);
        expect(result.structuredContent?.filenames).toEqual([]);
      });

      it('should return empty content when no matches in content mode', async () => {
        const result = await remote.grep.handler({
          pattern: 'ThisPatternDoesNotExistAnywhere12345',
          path: `${env.fixturesPath}/simple.txt`,
          output_mode: 'content',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('content');
        expect(result.structuredContent?.numLines).toBe(0);
        expect(result.structuredContent?.content).toBe('');
      });

      it('should return 0 when no matches in count mode', async () => {
        const result = await remote.grep.handler({
          pattern: 'ThisPatternDoesNotExistAnywhere12345',
          path: `${env.fixturesPath}/simple.txt`,
          output_mode: 'count',
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.mode).toBe('count');
        expect(result.structuredContent?.numMatches).toBe(0);
      });
    });
  });
}
