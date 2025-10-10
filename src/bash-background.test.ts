import { Client } from 'ssh2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BashTool } from './bash';

describe('BashTool', () => {
  describe('Background Execution', () => {
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

    it('should execute a simple command in background and return shellId', async () => {
      const result = await bashTool.execute({
        command: 'echo "Hello, Background!"',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();
      expect(result.shellId).toHaveLength(8);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');

      // Give it time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output.stdout).toContain('Hello, Background!');
      expect(output.status).toBe('completed');
      expect(output.exitCode).toBe(0);
    });

    it('should handle long-running background command', async () => {
      const result = await bashTool.execute({
        command: 'sleep 2 && echo "done"',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      // Check immediately - should be running
      const output1 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output1.status).toBe('running');
      expect(output1.exitCode).toBeUndefined();

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const output2 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output2.status).toBe('completed');
      expect(output2.stdout).toContain('done');
      expect(output2.exitCode).toBe(0);
    });

    it('should capture output incrementally from background command', async () => {
      const result = await bashTool.execute({
        command:
          'echo "line1" && sleep 0.5 && echo "line2" && sleep 0.5 && echo "line3"',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      // First check - might have line1
      await new Promise((resolve) => setTimeout(resolve, 200));
      const output1 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output1.status).toBe('running');

      // Second check - should have more output
      await new Promise((resolve) => setTimeout(resolve, 600));
      const output2 = await bashTool.getOutput({ shell_id: result.shellId! });

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 600));
      const output3 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output3.status).toBe('completed');

      // Combine all outputs
      const allOutput = output1.stdout + output2.stdout + output3.stdout;
      expect(allOutput).toContain('line1');
      expect(allOutput).toContain('line2');
      expect(allOutput).toContain('line3');
    });

    it('should handle background command with stderr', async () => {
      const result = await bashTool.execute({
        command: 'echo "stdout message" && echo "stderr message" >&2',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output.stdout).toContain('stdout message');
      expect(output.stderr).toContain('stderr message');
      expect(output.status).toBe('completed');
      expect(output.exitCode).toBe(0);
    });

    it('should handle background command that fails', async () => {
      const result = await bashTool.execute({
        command: 'ls /nonexistent_directory',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output.stderr).toContain('No such file or directory');
      expect(output.status).toBe('completed');
      expect(output.exitCode).not.toBe(0);
    });

    it('should filter output using regex', async () => {
      const result = await bashTool.execute({
        command:
          'echo "found1" && echo "skipped" && echo "found2" && echo "ignored"',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = await bashTool.getOutput({
        shell_id: result.shellId!,
        filter: '^found',
      });

      expect(output.stdout).toContain('found1');
      expect(output.stdout).toContain('found2');
      expect(output.stdout).not.toContain('skipped');
      expect(output.stdout).not.toContain('ignored');
    });

    it('should handle multiple background commands simultaneously', async () => {
      const result1 = await bashTool.execute({
        command: 'sleep 0.5 && echo "first done"',
        run_in_background: true,
      });

      const result2 = await bashTool.execute({
        command: 'sleep 0.3 && echo "second done"',
        run_in_background: true,
      });

      const result3 = await bashTool.execute({
        command: 'echo "third done"',
        run_in_background: true,
      });

      expect(result1.shellId).toBeDefined();
      expect(result2.shellId).toBeDefined();
      expect(result3.shellId).toBeDefined();
      expect(result1.shellId).not.toBe(result2.shellId);
      expect(result2.shellId).not.toBe(result3.shellId);

      await new Promise((resolve) => setTimeout(resolve, 600));

      const output1 = await bashTool.getOutput({ shell_id: result1.shellId! });
      const output2 = await bashTool.getOutput({ shell_id: result2.shellId! });
      const output3 = await bashTool.getOutput({ shell_id: result3.shellId! });

      expect(output1.stdout).toContain('first done');
      expect(output2.stdout).toContain('second done');
      expect(output3.stdout).toContain('third done');
      expect(output1.status).toBe('completed');
      expect(output2.status).toBe('completed');
      expect(output3.status).toBe('completed');
    });

    it('should kill a running background command', async () => {
      const result = await bashTool.execute({
        command: 'sleep 10 && echo "should not see this"',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      // Verify it's running
      await new Promise((resolve) => setTimeout(resolve, 100));
      const output1 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output1.status).toBe('running');

      // Kill it
      const killResult = await bashTool.killShell({
        shell_id: result.shellId!,
      });
      expect(killResult.killed).toBe(true);

      // Verify it's no longer running
      await new Promise((resolve) => setTimeout(resolve, 100));
      const output2 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output2.status).toBe('completed');
      expect(output2.stdout).not.toContain('should not see this');
      expect(output2.signal).toBe('SIGKILL');
    });

    it('should kill a running background command with custom signal', async () => {
      const result = await bashTool.execute({
        command: 'sleep 10 && echo "should not see this"',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      // Verify it's running
      await new Promise((resolve) => setTimeout(resolve, 100));
      const output1 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output1.status).toBe('running');

      // Kill it with TERM signal
      const killResult = await bashTool.killShell({
        shell_id: result.shellId!,
        signal: 'TERM',
      });
      expect(killResult.killed).toBe(true);

      // Verify it was terminated with the correct signal
      await new Promise((resolve) => setTimeout(resolve, 100));
      const output2 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output2.status).toBe('completed');
      expect(output2.signal).toBe('SIGTERM');
      expect(output2.stdout).not.toContain('should not see this');
    });

    it('should return false when killing non-existent shell', async () => {
      const killResult = await bashTool.killShell({ shell_id: 'nonexistent' });
      expect(killResult.killed).toBe(false);
    });

    it('should throw error when getting output from non-existent shell', async () => {
      await expect(
        bashTool.getOutput({ shell_id: 'nonexistent' }),
      ).rejects.toThrow('Shell not found');
    });

    it('should handle background command with large output', async () => {
      const result = await bashTool.execute({
        command: 'for i in {1..100}; do echo "Line $i"; done',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 200));

      const output = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output.stdout).toContain('Line 1');
      expect(output.stdout).toContain('Line 100');
      expect(output.status).toBe('completed');
    });

    it('should handle background command with pipes', async () => {
      const result = await bashTool.execute({
        command: 'echo "hello world" | tr "a-z" "A-Z"',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output.stdout).toContain('HELLO WORLD');
      expect(output.status).toBe('completed');
      expect(output.exitCode).toBe(0);
    });

    it('should clear output after each getOutput call', async () => {
      const result = await bashTool.execute({
        command: 'echo "message1" && sleep 0.3 && echo "message2"',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      // First read
      await new Promise((resolve) => setTimeout(resolve, 100));
      const output1 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output1.stdout).toContain('message1');

      // Second read - should only have new output
      await new Promise((resolve) => setTimeout(resolve, 400));
      const output2 = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output2.stdout).not.toContain('message1');
      expect(output2.stdout).toContain('message2');
    });

    it('should handle background command with environment variables', async () => {
      const result = await bashTool.execute({
        command: 'export TEST_VAR="background test" && echo $TEST_VAR',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output.stdout).toContain('background test');
      expect(output.status).toBe('completed');
    });

    it('should handle background command with file operations', async () => {
      const result = await bashTool.execute({
        command:
          'echo "background content" > /tmp/bg_test.txt && cat /tmp/bg_test.txt && rm /tmp/bg_test.txt',
        run_in_background: true,
      });

      expect(result.shellId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = await bashTool.getOutput({ shell_id: result.shellId! });
      expect(output.stdout).toContain('background content');
      expect(output.status).toBe('completed');
      expect(output.exitCode).toBe(0);
    });
  });
});
