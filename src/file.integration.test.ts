import fs from 'fs/promises';

import { Client, SFTPWrapper } from 'ssh2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
  });
});
