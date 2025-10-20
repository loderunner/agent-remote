import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { RemoteInstance, RemoteProvider, TestEnvironment } from '../provider';

/**
 * Test suite for file operations (read, write, edit).
 * Tests file manipulation, content handling, and edit functionality.
 *
 * @param provider - Remote provider implementation to test
 */
export function fileSuite(provider: RemoteProvider) {
  describe(`file tools [${provider.name}]`, () => {
    let remote: RemoteInstance;
    let env: TestEnvironment;

    beforeAll(async () => {
      remote = await provider.connect();
      env = provider.getTestEnvironment();
    });

    afterAll(async () => {
      await provider.disconnect(remote);
    });

    describe('read', () => {
      it('should read entire file', async () => {
        const result = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.numLines).toBeGreaterThan(0);
        expect(result.structuredContent?.totalLines).toBe(
          result.structuredContent?.numLines,
        );
        expect(result.structuredContent?.startLine).toBe(1);
      });

      it('should read file with offset', async () => {
        const result = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          offset: 3,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.startLine).toBe(3);
        expect(result.structuredContent?.numLines).toBeLessThan(
          result.structuredContent?.totalLines!,
        );
      });

      it('should read file with limit', async () => {
        const result = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          limit: 3,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.startLine).toBe(1);
        expect(result.structuredContent?.numLines).toBe(3);
      });

      it('should read file with offset and limit', async () => {
        const result = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          offset: 2,
          limit: 3,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.startLine).toBe(2);
        expect(result.structuredContent?.numLines).toBe(3);
      });

      it('should handle offset of 1 as first line', async () => {
        const result = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          offset: 1,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.startLine).toBe(1);
        expect(result.structuredContent?.numLines).toBe(
          result.structuredContent?.totalLines,
        );
      });

      it('should handle large offset gracefully', async () => {
        const result = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          offset: 1000,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.startLine).toBe(1000);
        expect(result.structuredContent?.numLines).toBe(0);
        expect(result.structuredContent?.content).toBe('');
      });

      it('should handle zero limit', async () => {
        const result = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          limit: 0,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.numLines).toBe(0);
        expect(result.structuredContent?.content).toBe('');
      });

      it('should return error for non-existent file', async () => {
        const result = await remote.read.handler({
          file_path: `${env.fixturesPath}/does-not-exist.txt`,
        });

        expect(result.isError).toBe(true);
      });
    });

    describe('write', () => {
      it('should write new file', async () => {
        const content = 'Hello from test\nLine 2\nLine 3';
        const filePath = `${env.testFilesPath}/new-file.txt`;

        const writeResult = await remote.write.handler({
          file_path: filePath,
          content,
        });

        expect(writeResult.isError).not.toBe(true);
        expect(writeResult.structuredContent?.content).toBe(content);

        const readResult = await remote.read.handler({
          file_path: filePath,
        });

        expect(readResult.isError).not.toBe(true);
        expect(readResult.structuredContent?.content).toBe(content);
      });

      it('should overwrite existing file', async () => {
        const filePath = `${env.testFilesPath}/overwrite-test.txt`;
        const firstContent = 'First content';
        const secondContent = 'Second content\nWith multiple lines';

        await remote.write.handler({
          file_path: filePath,
          content: firstContent,
        });

        let readResult = await remote.read.handler({
          file_path: filePath,
        });
        expect(readResult.isError).not.toBe(true);
        expect(readResult.structuredContent?.content).toBe(firstContent);

        await remote.write.handler({
          file_path: filePath,
          content: secondContent,
        });

        readResult = await remote.read.handler({
          file_path: filePath,
        });
        expect(readResult.isError).not.toBe(true);
        expect(readResult.structuredContent?.content).toBe(secondContent);
      });

      it('should write empty file', async () => {
        const filePath = `${env.testFilesPath}/empty-test.txt`;
        const content = '';

        await remote.write.handler({
          file_path: filePath,
          content,
        });

        const readResult = await remote.read.handler({
          file_path: filePath,
        });

        expect(readResult.isError).not.toBe(true);
        expect(readResult.structuredContent?.content).toBe('');
      });

      it('should write file with special characters', async () => {
        const filePath = `${env.testFilesPath}/special-chars.txt`;
        const content =
          'Special: !@#$%^&*()_+-=[]{}|;:,.<>?\nUnicode: 你好 世界 🎉';

        await remote.write.handler({
          file_path: filePath,
          content,
        });

        const readResult = await remote.read.handler({
          file_path: filePath,
        });

        expect(readResult.isError).not.toBe(true);
        expect(readResult.structuredContent?.content).toBe(content);
      });
    });

    describe('edit', () => {
      let originalSimpleContent: string;
      let originalLogContent: string;
      let originalAppContent: string;
      let originalConfigContent: string;

      beforeAll(async () => {
        // Store original contents
        const simpleRead = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
        });
        originalSimpleContent = simpleRead.structuredContent!.content;

        const logRead = await remote.read.handler({
          file_path: `${env.fixturesPath}/log.txt`,
        });
        originalLogContent = logRead.structuredContent!.content;

        const appRead = await remote.read.handler({
          file_path: `${env.fixturesPath}/code/app.js`,
        });
        originalAppContent = appRead.structuredContent!.content;

        const configRead = await remote.read.handler({
          file_path: `${env.fixturesPath}/code/config.py`,
        });
        originalConfigContent = configRead.structuredContent!.content;
      });

      afterEach(async () => {
        // Restore original contents
        await remote.write.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          content: originalSimpleContent,
        });
        await remote.write.handler({
          file_path: `${env.fixturesPath}/log.txt`,
          content: originalLogContent,
        });
        await remote.write.handler({
          file_path: `${env.fixturesPath}/code/app.js`,
          content: originalAppContent,
        });
        await remote.write.handler({
          file_path: `${env.fixturesPath}/code/config.py`,
          content: originalConfigContent,
        });
      });

      it('should replace first occurrence only', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          old_string: 'Line',
          new_string: 'Modified',
          replace_all: false,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(1);
        expect(result.structuredContent?.diff.hunks.length).toBe(1);

        const readResult = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
        });
        expect(readResult.structuredContent?.content).toContain(
          'Modified 1: Hello World',
        );
        expect(readResult.structuredContent?.content).toContain(
          'Line 2: This is a test',
        );
      });

      it('should replace all occurrences', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          old_string: 'Line',
          new_string: 'Row',
          replace_all: true,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(5);
        expect(result.structuredContent?.diff.hunks.length).toBe(1);

        const readResult = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
        });
        expect(readResult.structuredContent?.content).not.toContain('Line');
        expect(readResult.structuredContent?.content).toContain(
          'Row 1: Hello World',
        );
        expect(readResult.structuredContent?.content).toContain(
          'Row 2: This is a test',
        );
      });

      it('should return zero replacements when no match found', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          old_string: 'NOTFOUND',
          new_string: 'CHANGED',
          replace_all: false,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(0);
        expect(result.structuredContent?.diff.hunks.length).toBe(0);

        const readResult = await remote.read.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
        });
        expect(readResult.structuredContent?.content).toBe(
          originalSimpleContent,
        );
      });

      it('should handle multiline string replacements', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/log.txt`,
          old_string:
            '[2024-01-01 10:00:01] INFO: Connected to database\n[2024-01-01 10:05:23] WARNING: High memory usage detected',
          new_string: '[2024-01-01 10:00:01] INFO: Connection established',
          replace_all: false,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(1);
        expect(result.structuredContent?.diff.hunks.length).toBe(1);

        const readResult = await remote.read.handler({
          file_path: `${env.fixturesPath}/log.txt`,
        });
        expect(readResult.structuredContent?.content).toContain(
          'Connection established',
        );
        expect(readResult.structuredContent?.content).not.toContain(
          'Connected to database',
        );
        expect(readResult.structuredContent?.content).not.toContain(
          'High memory usage detected',
        );
      });

      it('should handle special characters in strings', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/code/app.js`,
          old_string: "res.send('Hello World!');",
          new_string: "res.json({ message: 'Hello World!' });",
          replace_all: false,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(1);
        expect(result.structuredContent?.diff.hunks.length).toBe(1);

        const readResult = await remote.read.handler({
          file_path: `${env.fixturesPath}/code/app.js`,
        });
        expect(readResult.structuredContent?.content).toContain(
          "res.json({ message: 'Hello World!' });",
        );
      });

      it('should generate valid diff structure', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/simple.txt`,
          old_string: 'Line 3: Searching for patterns',
          new_string: 'Line 3: Modified pattern search',
          replace_all: false,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(1);
        expect(result.structuredContent?.diff.hunks.length).toBe(1);

        const hunk = result.structuredContent!.diff.hunks[0];
        expect(hunk.oldStart).toBeGreaterThan(0);
        expect(hunk.newStart).toBeGreaterThan(0);
        expect(hunk.oldLines).toBeGreaterThan(0);
        expect(hunk.newLines).toBeGreaterThan(0);
        expect(hunk.lines.length).toBeGreaterThan(0);

        // Check that we have removed and added lines (prefixed with - and +)
        expect(hunk.lines).toSatisfyAny((l: string) => l.startsWith('-'));
        expect(hunk.lines).toSatisfyAny((l: string) => l.startsWith('+'));
      });

      it('should generate diff with multiple hunks', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/code/config.py`,
          old_string: 'DATABASE',
          new_string: 'DB',
          replace_all: true,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(5);
        expect(result.structuredContent?.diff.hunks.length).toBeGreaterThan(1);

        for (const hunk of result.structuredContent!.diff.hunks) {
          expect(hunk.oldStart).toBeGreaterThan(0);
          expect(hunk.newStart).toBeGreaterThan(0);
          expect(hunk.lines.length).toBeGreaterThan(0);
        }
      });

      it('should handle empty string as new_string', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/log.txt`,
          old_string: 'WARNING: High memory usage detected',
          new_string: '',
          replace_all: false,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(1);

        const readResult = await remote.read.handler({
          file_path: `${env.fixturesPath}/log.txt`,
        });
        expect(readResult.structuredContent?.content).not.toContain(
          'WARNING: High memory usage detected',
        );
      });

      it('should handle multiple replacements in same line', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/code/config.py`,
          old_string: 'Config',
          new_string: 'Settings',
          replace_all: true,
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent?.replacements).toBe(14);

        const readResult = await remote.read.handler({
          file_path: `${env.fixturesPath}/code/config.py`,
        });
        expect(readResult.structuredContent?.content).toContain(
          'DevelopmentSettings(Settings)',
        );
      });

      it('should return error for non-existent file', async () => {
        const result = await remote.edit.handler({
          file_path: `${env.fixturesPath}/does-not-exist.txt`,
          old_string: 'OLD',
          new_string: 'NEW',
          replace_all: false,
        });

        expect(result.isError).toBe(true);
      });
    });

    describe('round-trip tests', () => {
      it('should preserve content through read-write-read cycle', async () => {
        const filePath = `${env.fixturesPath}/log.txt`;
        const testFilePath = `${env.testFilesPath}/roundtrip.txt`;

        const originalRead = await remote.read.handler({
          file_path: filePath,
        });

        await remote.write.handler({
          file_path: testFilePath,
          content: originalRead.structuredContent!.content,
        });

        const finalRead = await remote.read.handler({
          file_path: testFilePath,
        });

        expect(finalRead.structuredContent?.content).toBe(
          originalRead.structuredContent?.content,
        );
        expect(finalRead.structuredContent?.numLines).toBe(
          originalRead.structuredContent?.numLines,
        );
        expect(finalRead.structuredContent?.totalLines).toBe(
          originalRead.structuredContent?.totalLines,
        );
      });
    });
  });
}
