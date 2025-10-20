import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RemoteInstance, RemoteProvider } from '../provider';

/**
 * Test suite for bash tool foreground execution.
 * Tests command execution, output capture, exit codes, etc.
 *
 * @param provider - Remote provider implementation to test
 */
export function bashForegroundSuite(provider: RemoteProvider) {
  describe(`bash tool - foreground execution [${provider.name}]`, () => {
    let remote: RemoteInstance;

    beforeAll(async () => {
      remote = await provider.connect();
    });

    afterAll(async () => {
      await provider.disconnect(remote);
    });

    it('should execute a simple command and return output', async () => {
      const result = await remote.bash.handler({
        command: 'echo "Hello, World!"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('Hello, World!');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should execute a command and capture non-zero exit code', async () => {
      const result = await remote.bash.handler({
        command: 'false',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.exitCode).toBe(1);
    });

    it('should handle multiline output', async () => {
      const result = await remote.bash.handler({
        command: 'printf "line1\\nline2\\nline3\\n"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('line1');
      expect(result.content[0].text).toContain('line2');
      expect(result.content[0].text).toContain('line3');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle commands with special characters', async () => {
      const result = await remote.bash.handler({
        command: 'echo "Special chars: $HOME | grep | > < & ; ()"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('Special chars:');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle command with pipes', async () => {
      const result = await remote.bash.handler({
        command: 'echo "hello world" | tr "a-z" "A-Z"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('HELLO WORLD');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle command with redirection', async () => {
      const result = await remote.bash.handler({
        command:
          'echo "test content" > /tmp/test_file.txt && cat /tmp/test_file.txt && rm /tmp/test_file.txt',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('test content');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle command with environment variables', async () => {
      const result = await remote.bash.handler({
        command: 'TEST_VAR="hello" && echo $TEST_VAR',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('hello');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle command that takes some time', async () => {
      const result = await remote.bash.handler({
        command: 'sleep 1 && echo "done"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('done');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should preserve working directory between commands', async () => {
      const result1 = await remote.bash.handler({
        command: 'cd /tmp',
      });
      expect(result1.isError).not.toBe(true);
      expect(result1.structuredContent?.exitCode).toBe(0);

      const result2 = await remote.bash.handler({
        command: 'pwd',
      });
      expect(result2.isError).not.toBe(true);
      expect(result2.content[0].text).toContain('/tmp');
    });

    it('should handle commands with large output', async () => {
      const result = await remote.bash.handler({
        command: 'for i in {1..100}; do echo "Line $i"; done',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('Line 1');
      expect(result.content[0].text).toContain('Line 100');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle command that fails', async () => {
      const result = await remote.bash.handler({
        command: 'ls /nonexistent_directory',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('No such file or directory');
      expect(result.structuredContent?.exitCode).not.toBe(0);
    });

    it('should capture output for failing command', async () => {
      const result = await remote.bash.handler({
        command: 'echo "before error" && ls /nonexistent_path_xyz',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('before error');
      expect(result.content[0].text).toContain('No such file or directory');
      expect(result.structuredContent?.exitCode).not.toBe(0);
    });

    it('should handle command with semicolons', async () => {
      const result = await remote.bash.handler({
        command: 'echo "first"; echo "second"; echo "third"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('first');
      expect(result.content[0].text).toContain('second');
      expect(result.content[0].text).toContain('third');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle command with && operator', async () => {
      const result = await remote.bash.handler({
        command: 'echo "success" && echo "also success"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('success');
      expect(result.content[0].text).toContain('also success');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle command with || operator on failure', async () => {
      const result = await remote.bash.handler({
        command: 'false || echo "fallback"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('fallback');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle command that is just whitespace', async () => {
      const result = await remote.bash.handler({
        command: 'true',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.exitCode).toBe(0);
      expect(result.content[0].text).toBe('');
    });

    it('should handle command with quotes', async () => {
      const result = await remote.bash.handler({
        command: 'echo "double quotes" && echo \'single quotes\'',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('double quotes');
      expect(result.content[0].text).toContain('single quotes');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should handle subcommand', async () => {
      const result = await remote.bash.handler({
        command: 'cd /tmp && echo "Current dir: $(pwd)"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('Current dir:');
      expect(result.content[0].text).toContain('/tmp');
      expect(result.structuredContent?.exitCode).toBe(0);
    });

    it('should not include the command itself in output', async () => {
      const command = 'echo "test output"';
      const result = await remote.bash.handler({ command });

      expect(result.isError).not.toBe(true);
      const { text } = result.content[0];
      const lines = text.split('\n').filter((line: string) => line.trim());
      expect(lines).not.toContain(
        expect.stringMatching(new RegExp(`^${command}`)),
      );
      expect(lines.some((line: string) => line.includes('test output'))).toBe(
        true,
      );
    });

    it('should timeout a long-running foreground command', async () => {
      const result = await remote.bash.handler({
        command: 'sleep 3',
        timeout: 500,
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.killed).toBe(true);
      expect(result.structuredContent?.exitCode).toBeUndefined();
    });

    it('should respect custom timeout value', async () => {
      const start = Date.now();
      const result = await remote.bash.handler({
        command: 'sleep 3',
        timeout: 300,
      });
      const duration = Date.now() - start;

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.killed).toBe(true);

      // Should timeout around 300ms, give or take some margin
      expect(duration).toBeGreaterThanOrEqual(250);
      expect(duration).toBeLessThan(1000);
    });

    it('should not timeout if command completes within timeout', async () => {
      const result = await remote.bash.handler({
        command: 'sleep 0.3 && echo "completed"',
        timeout: 2000,
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.killed).not.toBe(true);
    });

    it('should capture output including errors', async () => {
      const result = await remote.bash.handler({
        command:
          'echo "before error" && ls /nonexistent_path_abc && echo "after error"',
      });

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('before error');
      expect(result.content[0].text).toMatch(
        /before error.*No such file or directory/s,
      );
      expect(result.structuredContent?.exitCode).not.toBe(0);
    });
  });
}
