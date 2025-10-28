/* eslint-disable @typescript-eslint/unbound-method */
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { FileTool } from './file';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

function createMockProcess() {
  const process = new EventEmitter() as ChildProcess;
  process.stdout = new EventEmitter() as any;
  process.stderr = new EventEmitter() as any;

  // Emit close asynchronously to allow event listeners to be attached
  setImmediate(() => process.emit('close', 0));

  return process;
}

describe('Unit Tests', () => {
  describe('FileTool', () => {
    describe('read', () => {
      it('should execute cat command to read file', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        const process = createMockProcess();
        mockSpawn.mockImplementation(() => {
          setImmediate(() => {
            process.stdout.emit('data', Buffer.from('test content\n'));
          });
          return process;
        });

        const fileTool = new FileTool('test-container');

        await fileTool.read({
          file_path: '/home/dev/test.txt',
        });

        expect(mockSpawn).toHaveBeenCalledWith('docker', [
          'exec',
          '-i',
          'test-container',
          'cat',
          '/home/dev/test.txt',
        ]);
      });
    });

    describe('write', () => {
      it('should execute printf command to write file', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const fileTool = new FileTool('test-container');

        await fileTool.write({
          file_path: '/home/dev/output.txt',
          content: 'test content',
        });

        expect(mockSpawn).toHaveBeenCalledWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          `printf '%s' 'test content' > "/home/dev/output.txt"`,
        ]);
      });

      it('should escape single quotes in content', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const fileTool = new FileTool('test-container');

        await fileTool.write({
          file_path: '/home/dev/output.txt',
          content: "it's a test",
        });

        expect(mockSpawn).toHaveBeenCalledWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          `printf '%s' 'it'\\''s a test' > "/home/dev/output.txt"`,
        ]);
      });
    });
  });
});


