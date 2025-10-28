/* eslint-disable @typescript-eslint/unbound-method */
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { GrepTool } from './grep';

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
  describe('GrepTool', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('Command Building', () => {
      it('should build basic grep command with pattern and path', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const grepTool = new GrepTool('test-container');

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev/fixtures',
          output_mode: 'content',
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'grep -r "ERROR" "/home/dev/fixtures"',
        ]);
      });

      it('should add glob pattern with --include flag', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const grepTool = new GrepTool('test-container');

        await grepTool.grep({
          pattern: 'TODO',
          path: '/home/dev/code',
          glob: '*.js',
          output_mode: 'content',
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'grep -r --include "*.js" "TODO" "/home/dev/code"',
        ]);
      });

      it('should add -l flag for files_with_matches mode', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const grepTool = new GrepTool('test-container');

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'files_with_matches',
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'grep -r -l "ERROR" "/home/dev"',
        ]);
      });

      it('should add context flags in content mode', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const grepTool = new GrepTool('test-container');

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          '-B': 3,
          '-A': 2,
          '-C': 5,
          '-n': true,
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'grep -r -B 3 -A 2 -C 5 -n "ERROR" "/home/dev"',
        ]);
      });

      it('should add -i flag for case insensitive search', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const grepTool = new GrepTool('test-container');

        await grepTool.grep({
          pattern: 'error',
          path: '/home/dev',
          output_mode: 'content',
          '-i': true,
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'grep -r -i "error" "/home/dev"',
        ]);
      });

      it('should add head pipe for head_limit', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const grepTool = new GrepTool('test-container');

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          head_limit: 10,
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'grep -r "ERROR" "/home/dev" | head -10',
        ]);
      });

      it('should add wc -l pipe for count mode', async () => {
        const { spawn } = await import('node:child_process');
        const mockSpawn = spawn as any;
        mockSpawn.mockImplementation(() => createMockProcess());

        const grepTool = new GrepTool('test-container');

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'count',
        });

        expect(mockSpawn).toHaveBeenCalledExactlyOnceWith('docker', [
          'exec',
          '-i',
          'test-container',
          'sh',
          '-c',
          'grep -r "ERROR" "/home/dev" | wc -l',
        ]);
      });
    });
  });
});
