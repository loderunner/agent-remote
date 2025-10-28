/* eslint-disable @typescript-eslint/unbound-method */
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { GlobTool } from './glob';

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
  describe('GlobTool', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('Command Building', () => {
      it('should build basic find command for simple pattern', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const globTool = new GlobTool('test-container');

        await globTool.glob({
          base_path: '/home/dev/fixtures',
          pattern: '*.txt',
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'find "/home/dev/fixtures" -mindepth 1 -maxdepth 1',
        ]);
      });

      it('should build recursive find command for globstar pattern', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const globTool = new GlobTool('test-container');

        await globTool.glob({
          base_path: '/home/dev',
          pattern: '**/*.ts',
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'find "/home/dev" -mindepth 1',
        ]);
      });

      it('should build recursive find command for pattern with slash', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const globTool = new GlobTool('test-container');

        await globTool.glob({
          base_path: '/home/dev',
          pattern: 'src/*.js',
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'find "/home/dev" -mindepth 1',
        ]);
      });
    });
  });
});
