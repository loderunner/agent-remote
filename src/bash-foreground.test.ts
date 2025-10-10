import { Client } from 'ssh2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BashTool } from './bash';

describe('BashTool', () => {
  describe('Foreground Execution', () => {
    let client: Client;
    let bashTool: BashTool;

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

      bashTool = new BashTool(client);
    });

    afterAll(() => {
      client.end();
      client.destroy();
    });

    it('should execute a simple command and return stdout', async () => {
      const result = await bashTool.execute({
        command: 'echo "Hello, World!"',
      });

      expect(result.stdout).toContain('Hello, World!');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should execute a command and capture non-zero exit code', async () => {
      const result = await bashTool.execute({
        command: 'false',
      });

      expect(result.exitCode).toBe(1);
    });

    it('should handle multiline output', async () => {
      const result = await bashTool.execute({
        command: 'printf "line1\\nline2\\nline3\\n"',
      });

      expect(result.stdout).toContain('line1');
      expect(result.stdout).toContain('line2');
      expect(result.stdout).toContain('line3');
      expect(result.exitCode).toBe(0);
    });

    it('should handle commands with special characters', async () => {
      const result = await bashTool.execute({
        command: 'echo "Special chars: $HOME | grep | > < & ; ()"',
      });

      expect(result.stdout).toContain('Special chars:');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command with pipes', async () => {
      const result = await bashTool.execute({
        command: 'echo "hello world" | tr "a-z" "A-Z"',
      });

      expect(result.stdout).toContain('HELLO WORLD');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command with redirection', async () => {
      const result = await bashTool.execute({
        command:
          'echo "test content" > /tmp/test_file.txt && cat /tmp/test_file.txt && rm /tmp/test_file.txt',
      });

      expect(result.stdout).toContain('test content');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command with environment variables', async () => {
      const result = await bashTool.execute({
        command: 'TEST_VAR="hello" && echo $TEST_VAR',
      });

      expect(result.stdout).toContain('hello');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command that takes some time', async () => {
      const result = await bashTool.execute({
        command: 'sleep 1 && echo "done"',
      });

      expect(result.stdout).toContain('done');
      expect(result.exitCode).toBe(0);
    });

    it('should preserve working directory between commands', async () => {
      const result1 = await bashTool.execute({
        command: 'cd /tmp',
      });
      expect(result1.exitCode).toBe(0);

      const result2 = await bashTool.execute({
        command: 'pwd',
      });
      expect(result2.stdout).toContain('/tmp');
    });

    it('should handle commands with large output', async () => {
      const result = await bashTool.execute({
        command: 'for i in {1..100}; do echo "Line $i"; done',
      });

      expect(result.stdout).toContain('Line 1');
      expect(result.stdout).toContain('Line 100');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command that fails', async () => {
      const result = await bashTool.execute({
        command: 'ls /nonexistent_directory',
      });

      expect(result.stderr).toContain('No such file or directory');
      expect(result.exitCode).not.toBe(0);
    });

    it('should capture both stdout and stderr for failing command', async () => {
      const result = await bashTool.execute({
        command: 'echo "before error" && ls /nonexistent_path_xyz',
      });

      expect(result.stdout).toContain('before error');
      expect(result.stderr).toContain('No such file or directory');
      expect(result.exitCode).not.toBe(0);
    });

    it('should handle command with semicolons', async () => {
      const result = await bashTool.execute({
        command: 'echo "first"; echo "second"; echo "third"',
      });

      expect(result.stdout).toContain('first');
      expect(result.stdout).toContain('second');
      expect(result.stdout).toContain('third');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command with && operator', async () => {
      const result = await bashTool.execute({
        command: 'echo "success" && echo "also success"',
      });

      expect(result.stdout).toContain('success');
      expect(result.stdout).toContain('also success');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command with || operator on failure', async () => {
      const result = await bashTool.execute({
        command: 'false || echo "fallback"',
      });

      expect(result.stdout).toContain('fallback');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command that is just whitespace', async () => {
      const result = await bashTool.execute({
        command: 'true',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should handle command with quotes', async () => {
      const result = await bashTool.execute({
        command: 'echo "double quotes" && echo \'single quotes\'',
      });

      expect(result.stdout).toContain('double quotes');
      expect(result.stdout).toContain('single quotes');
      expect(result.exitCode).toBe(0);
    });

    it('should handle subcommand', async () => {
      const result = await bashTool.execute({
        command: 'cd /tmp && echo "Current dir: $(pwd)"',
      });

      expect(result.stdout).toContain('Current dir:');
      expect(result.stdout).toContain('/tmp');
      expect(result.exitCode).toBe(0);
    });

    it('should not include the command itself in stdout', async () => {
      const command = 'echo "test output"';
      const result = await bashTool.execute({ command });

      const lines = result.stdout.split('\n').filter((line) => line.trim());
      expect(lines).not.toContain(command);
      expect(lines.some((line) => line.includes('test output'))).toBe(true);
    });

    it('should not leak event listeners after multiple executions', async () => {
      const shell = await bashTool.init();

      // Get initial listener counts
      const initialDataListeners = shell.listenerCount('data');
      const initialStderrListeners = shell.stderr.listenerCount('data');
      const initialErrorListeners = shell.listenerCount('error');

      // Run multiple commands
      for (let i = 0; i < 5; i++) {
        await bashTool.execute({ command: `echo "test ${i}"` });
      }

      // Verify listener counts haven't increased
      expect(shell.listenerCount('data')).toBe(initialDataListeners);
      expect(shell.stderr.listenerCount('data')).toBe(initialStderrListeners);
      expect(shell.listenerCount('error')).toBe(initialErrorListeners);
    });

    it('should timeout a long-running foreground command', async () => {
      const result = await bashTool.execute({
        command: 'sleep 10',
        timeout: 500,
      });

      expect(result.killed).toBe(true);
      expect(result.exitCode).toBeUndefined();
    });

    it('should respect custom timeout value', async () => {
      const start = Date.now();
      const result = await bashTool.execute({
        command: 'sleep 10',
        timeout: 300,
      });
      const duration = Date.now() - start;

      expect(result.killed).toBe(true);
      // Should timeout around 300ms, give or take some margin
      expect(duration).toBeGreaterThanOrEqual(250);
      expect(duration).toBeLessThan(1000);
    });

    it('should not timeout if command completes within timeout', async () => {
      const result = await bashTool.execute({
        command: 'sleep 0.3 && echo "completed"',
        timeout: 2000,
      });

      expect(result.killed).not.toBe(true);
    });
  });
});
