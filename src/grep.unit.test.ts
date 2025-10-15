/* eslint-disable @typescript-eslint/unbound-method */
import { EventEmitter } from 'node:events';

import { Channel, Client } from 'ssh2';
import { describe, expect, it, vi } from 'vitest';

import { GrepTool } from './grep';

function createMockClient() {
  const client = {
    exec: vi.fn(
      (
        _command: string,
        callback: (error: Error | null, channel: Channel) => void,
      ) => {
        const channel = new EventEmitter() as Channel;
        callback(null, channel);
        // Emit close asynchronously to allow event listeners to be attached
        setImmediate(() => channel.emit('close'));
        return client;
      },
    ),
  };
  return client as unknown as Client;
}

describe('Unit Tests', () => {
  describe('GrepTool', () => {
    describe('Command Building', () => {
      it('should build basic grep command with pattern and path', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev/fixtures',
          output_mode: 'content',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "ERROR" "/home/dev/fixtures"',
          expect.any(Function),
        );
      });

      it('should add glob pattern with --include flag', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'TODO',
          path: '/home/dev/code',
          glob: '*.js',
          output_mode: 'content',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r --include "*.js" "TODO" "/home/dev/code"',
          expect.any(Function),
        );
      });

      it('should add -l flag for files_with_matches mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'files_with_matches',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -l "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should add -B flag for before context in content mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          '-B': 3,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -B 3 "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should add -A flag for after context in content mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          '-A': 2,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -A 2 "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should add -C flag for context in content mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          '-C': 5,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -C 5 "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should add -n flag for line numbers in content mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          '-n': true,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -n "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should ignore context flags in files_with_matches mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'files_with_matches',
          '-A': 3,
          '-B': 2,
          '-C': 1,
          '-n': true,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -l "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should add -i flag for case insensitive search', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'error',
          path: '/home/dev',
          output_mode: 'content',
          '-i': true,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -i "error" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should add head pipe for head_limit', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          head_limit: 10,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "ERROR" "/home/dev" | head -10',
          expect.any(Function),
        );
      });

      it('should add wc -l pipe for count mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'count',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "ERROR" "/home/dev" | wc -l',
          expect.any(Function),
        );
      });

      it('should combine head_limit and count mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'count',
          head_limit: 5,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "ERROR" "/home/dev" | head -5 | wc -l',
          expect.any(Function),
        );
      });

      it('should build complex command with multiple flags', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'todo',
          path: '/home/dev/code',
          glob: '*.ts',
          output_mode: 'content',
          '-B': 2,
          '-A': 3,
          '-n': true,
          '-i': true,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r --include "*.ts" -B 2 -A 3 -n -i "todo" "/home/dev/code"',
          expect.any(Function),
        );
      });

      it('should build command with all content flags and head_limit', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'debug',
          path: '/home/dev',
          glob: '*.py',
          output_mode: 'content',
          '-C': 4,
          '-n': true,
          '-i': true,
          head_limit: 20,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r --include "*.py" -C 4 -n -i "debug" "/home/dev" | head -20',
          expect.any(Function),
        );
      });

      it('should handle floating point numbers by truncating to integers', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          '-B': 3.7,
          '-A': 2.3,
          '-C': 5.9,
          head_limit: 10.5,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -B 3 -A 2 -C 5 "ERROR" "/home/dev" | head -10',
          expect.any(Function),
        );
      });

      it('should handle special regex patterns', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: '^ERROR.*$',
          path: '/var/log',
          output_mode: 'content',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "^ERROR.*$" "/var/log"',
          expect.any(Function),
        );
      });

      it('should not add -n flag when false in content mode', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          '-n': false,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should not add -i flag when false', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
          output_mode: 'content',
          '-i': false,
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should default to files_with_matches when output_mode is undefined', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r -l "ERROR" "/home/dev"',
          expect.any(Function),
        );
      });

      it('should handle paths with spaces', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'ERROR',
          path: '/home/dev/my folder',
          output_mode: 'content',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "ERROR" "/home/dev/my folder"',
          expect.any(Function),
        );
      });

      it('should handle patterns with spaces', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'error message',
          path: '/var/log',
          output_mode: 'content',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "error message" "/var/log"',
          expect.any(Function),
        );
      });

      it('should handle patterns with double quotes by escaping them', async () => {
        const client = createMockClient();
        const grepTool = new GrepTool(client);

        await grepTool.grep({
          pattern: 'error "critical" message',
          path: '/var/log',
          output_mode: 'content',
        });

        expect(client.exec).toHaveBeenCalledOnce();
        expect(client.exec).toHaveBeenCalledWith(
          'grep -r "error \\"critical\\" message" "/var/log"',
          expect.any(Function),
        );
      });
    });
  });
});
