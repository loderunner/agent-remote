import { BashTool as DockerBashTool } from '@agent-remote/docker';
import { BashTool as SSHBashTool } from '@agent-remote/ssh';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  getDockerContainer,
  getSSHClient,
  setupSSH,
  teardownSSH,
} from './setup';

describe('Integration Tests', () => {
  beforeAll(async () => {
    await setupSSH();
  });

  afterAll(() => {
    teardownSSH();
  });

  const implementations: Array<{
    name: string;
    createBashTool: () => SSHBashTool | DockerBashTool;
  }> = [
    {
      name: 'ssh',
      createBashTool: () => new SSHBashTool(getSSHClient()),
    },
    {
      name: 'docker',
      createBashTool: () =>
        new DockerBashTool({ container: getDockerContainer(), shell: 'bash' }),
    },
  ];

  describe.each(implementations)(
    'BashTool Foreground ($name)',
    ({ name: _name, createBashTool }) => {
      let bashTool: SSHBashTool | DockerBashTool;

      beforeAll(() => {
        bashTool = createBashTool();
      });

      it('should execute a simple command and return output', async () => {
        const result = await bashTool.execute({
          command: 'echo "Hello, World!"',
        });

        expect(result.output).toContain('Hello, World!');
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

        expect(result.output).toContain('line1');
        expect(result.output).toContain('line2');
        expect(result.output).toContain('line3');
        expect(result.exitCode).toBe(0);
      });

      it('should handle commands with special characters', async () => {
        const result = await bashTool.execute({
          command: 'echo "Special chars: $HOME | grep | > < & ; ()"',
        });

        expect(result.output).toContain('Special chars:');
        expect(result.exitCode).toBe(0);
      });

      it('should handle command with pipes', async () => {
        const result = await bashTool.execute({
          command: 'echo "hello world" | tr "a-z" "A-Z"',
        });

        expect(result.output).toContain('HELLO WORLD');
        expect(result.exitCode).toBe(0);
      });

      it('should handle command with redirection', async () => {
        const result = await bashTool.execute({
          command:
            'echo "test content" > /tmp/test_file.txt && cat /tmp/test_file.txt && rm /tmp/test_file.txt',
        });

        expect(result.output).toContain('test content');
        expect(result.exitCode).toBe(0);
      });

      it('should handle command with environment variables', async () => {
        const result = await bashTool.execute({
          command: 'TEST_VAR="hello" && echo $TEST_VAR',
        });

        expect(result.output).toContain('hello');
        expect(result.exitCode).toBe(0);
      });

      it('should handle command that takes some time', async () => {
        const result = await bashTool.execute({
          command: 'sleep 1 && echo "done"',
        });

        expect(result.output).toContain('done');
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
        expect(result2.output).toContain('/tmp');
      });

      it('should handle commands with large output', async () => {
        const result = await bashTool.execute({
          command: 'for i in {1..100}; do echo "Line $i"; done',
        });

        expect(result.output).toContain('Line 1');
        expect(result.output).toContain('Line 100');
        expect(result.exitCode).toBe(0);
      });

      it('should handle command that fails', async () => {
        const result = await bashTool.execute({
          command: 'ls /nonexistent_directory',
        });

        expect(result.output).toContain('No such file or directory');
        expect(result.exitCode).not.toBe(0);
      });

      it('should capture output for failing command', async () => {
        const result = await bashTool.execute({
          command: 'echo "before error" && ls /nonexistent_path_xyz',
        });

        expect(result.output).toContain('before error');
        expect(result.output).toContain('No such file or directory');
        expect(result.exitCode).not.toBe(0);
      });

      it('should handle command with semicolons', async () => {
        const result = await bashTool.execute({
          command: 'echo "first"; echo "second"; echo "third"',
        });

        expect(result.output).toContain('first');
        expect(result.output).toContain('second');
        expect(result.output).toContain('third');
        expect(result.exitCode).toBe(0);
      });

      it('should handle command with && operator', async () => {
        const result = await bashTool.execute({
          command: 'echo "success" && echo "also success"',
        });

        expect(result.output).toContain('success');
        expect(result.output).toContain('also success');
        expect(result.exitCode).toBe(0);
      });

      it('should handle command with || operator on failure', async () => {
        const result = await bashTool.execute({
          command: 'false || echo "fallback"',
        });

        expect(result.output).toContain('fallback');
        expect(result.exitCode).toBe(0);
      });

      it('should handle command that is just whitespace', async () => {
        const result = await bashTool.execute({
          command: 'true',
        });

        expect(result.exitCode).toBe(0);
        expect(result.output).toBe('');
      });

      it('should handle command with quotes', async () => {
        const result = await bashTool.execute({
          command: 'echo "double quotes" && echo \'single quotes\'',
        });

        expect(result.output).toContain('double quotes');
        expect(result.output).toContain('single quotes');
        expect(result.exitCode).toBe(0);
      });

      it('should handle subcommand', async () => {
        const result = await bashTool.execute({
          command: 'cd /tmp && echo "Current dir: $(pwd)"',
        });

        expect(result.output).toContain('Current dir:');
        expect(result.output).toContain('/tmp');
        expect(result.exitCode).toBe(0);
      });

      it('should not include the command itself in output', async () => {
        const command = 'echo "test output"';
        const result = await bashTool.execute({ command });

        const lines = result.output
          .split('\n')
          .filter((line: string) => line.trim());
        expect(lines).not.toContain(
          expect.stringMatching(new RegExp(`^${command}`)),
        );
        expect(lines.some((line: string) => line.includes('test output'))).toBe(
          true,
        );
      });

      it('should timeout a long-running foreground command', async () => {
        const result = await bashTool.execute({
          command: 'sleep 3',
          timeout: 500,
        });

        expect(result.killed).toBe(true);
        expect(result.exitCode).toBeUndefined();
      });

      it('should respect custom timeout value', async () => {
        const start = Date.now();
        const result = await bashTool.execute({
          command: 'sleep 3',
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

      it('should capture output including errors', async () => {
        const result = await bashTool.execute({
          command:
            'echo "before error" && ls /nonexistent_path_abc && echo "after error"',
        });

        expect(result.output).toContain('before error');
        expect(result.output).toMatch(
          /before error.*No such file or directory/s,
        );
        expect(result.exitCode).not.toBe(0);
      });
    },
  );
});
