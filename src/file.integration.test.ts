import fs from 'fs/promises';

import { Client, SFTPWrapper } from 'ssh2';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FileTool } from './file';

describe('Integration Tests', () => {
  describe('FileTool', () => {
    let client: Client;
    let sftp: SFTPWrapper;
    let fileTool: FileTool;
    let fileContent: string;
    let fileLines: string[];

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

      sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
        client.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(sftp);
        });
      });

      fileTool = new FileTool(sftp);

      fileContent = await fs.readFile('sandbox/fixtures/simple.txt', 'utf8');
      fileLines = fileContent.split('\n');
    });

    afterAll(() => {
      sftp.end();
      sftp.destroy();
      client.end();
      client.destroy();
    });

    describe('FileRead', () => {
      it('should read entire file', async () => {
        const result = await fileTool.read({
          file_path: '/home/dev/fixtures/simple.txt',
        });

        expect(result.numLines).toBe(fileLines.length);
        expect(result.totalLines).toBe(fileLines.length);
        expect(result.startLine).toBe(1);
        expect(result.content).toBe(fileContent);
      });

      it('should read file with offset', async () => {
        const result = await fileTool.read({
          file_path: '/home/dev/fixtures/simple.txt',
          offset: 3,
        });

        expect(result.startLine).toBe(3);
        expect(result.numLines).toBe(fileLines.length - 2);
        expect(result.totalLines).toBe(fileLines.length);
        expect(result.content).toBe(fileLines.slice(2).join('\n'));
      });

      it('should read file with limit', async () => {
        const result = await fileTool.read({
          file_path: '/home/dev/fixtures/simple.txt',
          limit: 3,
        });

        expect(result.startLine).toBe(1);
        expect(result.numLines).toBe(3);
        expect(result.totalLines).toBe(fileLines.length);
        expect(result.content).toBe(fileLines.slice(0, 3).join('\n'));
      });

      it('should read file with offset and limit', async () => {
        const result = await fileTool.read({
          file_path: '/home/dev/fixtures/simple.txt',
          offset: 2,
          limit: 3,
        });

        expect(result.startLine).toBe(2);
        expect(result.numLines).toBe(3);
        expect(result.totalLines).toBe(fileLines.length);
        expect(result.content).toBe(fileLines.slice(1, 4).join('\n'));
      });

      it('should handle offset of 1 as first line', async () => {
        const result = await fileTool.read({
          file_path: '/home/dev/fixtures/simple.txt',
          offset: 1,
        });

        expect(result.startLine).toBe(1);
        expect(result.numLines).toBe(result.totalLines);
      });

      it('should handle large offset gracefully', async () => {
        const result = await fileTool.read({
          file_path: '/home/dev/fixtures/simple.txt',
          offset: 1000,
        });

        expect(result.startLine).toBe(1000);
        expect(result.numLines).toBe(0);
        expect(result.content).toBe('');
      });

      it('should handle zero limit', async () => {
        const result = await fileTool.read({
          file_path: '/home/dev/fixtures/simple.txt',
          limit: 0,
        });

        expect(result.numLines).toBe(0);
        expect(result.content).toBe('');
      });

      it('should throw error for non-existent file', async () => {
        await expect(
          fileTool.read({
            file_path: '/home/dev/fixtures/does-not-exist.txt',
          }),
        ).rejects.toThrow();
      });
    });

    describe('FileWrite', () => {
      const testDir = '/home/dev/test-files';

      beforeAll(async () => {
        // Create test directory
        await new Promise<void>((resolve, reject) => {
          sftp.mkdir(testDir, { mode: 0o755 }, (err) => {
            // Ignore error if directory already exists
            if (err && err.message?.includes('Failure')) {
              resolve();
              return;
            }
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });

      it('should write new file', async () => {
        const content = 'Hello from test\nLine 2\nLine 3';
        const filePath = `${testDir}/new-file.txt`;

        const writeResult = await fileTool.write({
          file_path: filePath,
          content,
        });

        expect(writeResult.content).toBe(content);

        const readResult = await fileTool.read({
          file_path: filePath,
        });

        expect(readResult.content).toBe(content);
      });

      it('should overwrite existing file', async () => {
        const filePath = `${testDir}/overwrite-test.txt`;
        const firstContent = 'First content';
        const secondContent = 'Second content\nWith multiple lines';

        await fileTool.write({
          file_path: filePath,
          content: firstContent,
        });

        let readResult = await fileTool.read({
          file_path: filePath,
        });
        expect(readResult.content).toBe(firstContent);

        await fileTool.write({
          file_path: filePath,
          content: secondContent,
        });

        readResult = await fileTool.read({
          file_path: filePath,
        });
        expect(readResult.content).toBe(secondContent);
      });

      it('should write empty file', async () => {
        const filePath = `${testDir}/empty-test.txt`;
        const content = '';

        await fileTool.write({
          file_path: filePath,
          content,
        });

        const readResult = await fileTool.read({
          file_path: filePath,
        });

        expect(readResult.content).toBe('');
      });

      it('should write file with special characters', async () => {
        const filePath = `${testDir}/special-chars.txt`;
        const content =
          'Special: !@#$%^&*()_+-=[]{}|;:,.<>?\nUnicode: 你好 世界 🎉';

        await fileTool.write({
          file_path: filePath,
          content,
        });

        const readResult = await fileTool.read({
          file_path: filePath,
        });

        expect(readResult.content).toBe(content);
      });
    });

    describe('Round-trip tests', () => {
      it('should preserve content through read-write-read cycle', async () => {
        const filePath = '/home/dev/fixtures/log.txt';
        const testFilePath = '/home/dev/test-files/roundtrip.txt';

        const originalRead = await fileTool.read({
          file_path: filePath,
        });

        await fileTool.write({
          file_path: testFilePath,
          content: originalRead.content,
        });

        const finalRead = await fileTool.read({
          file_path: testFilePath,
        });

        expect(finalRead.content).toBe(originalRead.content);
        expect(finalRead.numLines).toBe(originalRead.numLines);
        expect(finalRead.totalLines).toBe(originalRead.totalLines);
      });
    });

    describe('FileEdit', () => {
      const simpleFilePath = '/home/dev/fixtures/simple.txt';
      const logFilePath = '/home/dev/fixtures/log.txt';
      const appFilePath = '/home/dev/fixtures/code/app.js';
      const configFilePath = '/home/dev/fixtures/code/config.py';

      let originalSimpleContent: string;
      let originalLogContent: string;
      let originalAppContent: string;
      let originalConfigContent: string;

      beforeAll(async () => {
        // Store original contents
        const simpleRead = await fileTool.read({ file_path: simpleFilePath });
        originalSimpleContent = simpleRead.content;

        const logRead = await fileTool.read({ file_path: logFilePath });
        originalLogContent = logRead.content;

        const appRead = await fileTool.read({ file_path: appFilePath });
        originalAppContent = appRead.content;

        const configRead = await fileTool.read({ file_path: configFilePath });
        originalConfigContent = configRead.content;
      });

      afterEach(async () => {
        // Restore original contents
        await fileTool.write({
          file_path: simpleFilePath,
          content: originalSimpleContent,
        });
        await fileTool.write({
          file_path: logFilePath,
          content: originalLogContent,
        });
        await fileTool.write({
          file_path: appFilePath,
          content: originalAppContent,
        });
        await fileTool.write({
          file_path: configFilePath,
          content: originalConfigContent,
        });
      });

      it('should replace first occurrence only', async () => {
        const result = await fileTool.edit({
          file_path: simpleFilePath,
          old_string: 'Line',
          new_string: 'Modified',
          replace_all: false,
        });

        expect(result.replacements).toBe(1);
        expect(result.diff.hunks.length).toBe(1);

        const readResult = await fileTool.read({ file_path: simpleFilePath });
        expect(readResult.content).toContain('Modified 1: Hello World');
        expect(readResult.content).toContain('Line 2: This is a test');
      });

      it('should replace all occurrences', async () => {
        const result = await fileTool.edit({
          file_path: simpleFilePath,
          old_string: 'Line',
          new_string: 'Row',
          replace_all: true,
        });

        expect(result.replacements).toBe(5);
        expect(result.diff.hunks.length).toBe(1);

        const readResult = await fileTool.read({ file_path: simpleFilePath });
        expect(readResult.content).not.toContain('Line');
        expect(readResult.content).toContain('Row 1: Hello World');
        expect(readResult.content).toContain('Row 2: This is a test');
      });

      it('should return zero replacements when no match found', async () => {
        const result = await fileTool.edit({
          file_path: simpleFilePath,
          old_string: 'NOTFOUND',
          new_string: 'CHANGED',
          replace_all: false,
        });

        expect(result.replacements).toBe(0);
        expect(result.diff.hunks.length).toBe(0);

        const readResult = await fileTool.read({ file_path: simpleFilePath });
        expect(readResult.content).toBe(originalSimpleContent);
      });

      it('should handle multiline string replacements', async () => {
        const result = await fileTool.edit({
          file_path: logFilePath,
          old_string:
            '[2024-01-01 10:00:01] INFO: Connected to database\n[2024-01-01 10:05:23] WARNING: High memory usage detected',
          new_string: '[2024-01-01 10:00:01] INFO: Connection established',
          replace_all: false,
        });

        expect(result.replacements).toBe(1);
        expect(result.diff.hunks.length).toBe(1);

        const readResult = await fileTool.read({ file_path: logFilePath });
        expect(readResult.content).toContain('Connection established');
        expect(readResult.content).not.toContain('Connected to database');
        expect(readResult.content).not.toContain('High memory usage detected');
      });

      it('should handle special characters in strings', async () => {
        const result = await fileTool.edit({
          file_path: appFilePath,
          old_string: "res.send('Hello World!');",
          new_string: "res.json({ message: 'Hello World!' });",
          replace_all: false,
        });

        expect(result.replacements).toBe(1);
        expect(result.diff.hunks.length).toBe(1);

        const readResult = await fileTool.read({ file_path: appFilePath });
        expect(readResult.content).toContain(
          "res.json({ message: 'Hello World!' });",
        );
      });

      it('should generate valid diff structure', async () => {
        const result = await fileTool.edit({
          file_path: simpleFilePath,
          old_string: 'Line 3: Searching for patterns',
          new_string: 'Line 3: Modified pattern search',
          replace_all: false,
        });

        expect(result.replacements).toBe(1);
        expect(result.diff.hunks.length).toBe(1);

        const hunk = result.diff.hunks[0];
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
        const result = await fileTool.edit({
          file_path: configFilePath,
          old_string: 'DATABASE',
          new_string: 'DB',
          replace_all: true,
        });

        expect(result.replacements).toBe(5);
        expect(result.diff.hunks.length).toBeGreaterThan(1);

        for (const hunk of result.diff.hunks) {
          expect(hunk.oldStart).toBeGreaterThan(0);
          expect(hunk.newStart).toBeGreaterThan(0);
          expect(hunk.lines.length).toBeGreaterThan(0);
        }
      });

      it('should handle empty string as new_string', async () => {
        const result = await fileTool.edit({
          file_path: logFilePath,
          old_string: 'WARNING: High memory usage detected',
          new_string: '',
          replace_all: false,
        });

        expect(result.replacements).toBe(1);

        const readResult = await fileTool.read({ file_path: logFilePath });
        expect(readResult.content).not.toContain(
          'WARNING: High memory usage detected',
        );
      });

      it('should handle multiple replacements in same line', async () => {
        const result = await fileTool.edit({
          file_path: configFilePath,
          old_string: 'Config',
          new_string: 'Settings',
          replace_all: true,
        });

        expect(result.replacements).toBe(14);

        const readResult = await fileTool.read({ file_path: configFilePath });
        expect(readResult.content).toContain('DevelopmentSettings(Settings)');
      });

      it('should throw error for non-existent file', async () => {
        await expect(
          fileTool.edit({
            file_path: '/home/dev/fixtures/does-not-exist.txt',
            old_string: 'OLD',
            new_string: 'NEW',
            replace_all: false,
          }),
        ).rejects.toThrow();
      });
    });
  });
});
