import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RemoteInstance, RemoteProvider } from '../provider';

/**
 * Test suite for bash tool background execution.
 * Tests background process management, shell ID handling, and output retrieval.
 *
 * @param provider - Remote provider implementation to test
 */
export function bashBackgroundSuite(provider: RemoteProvider) {
  describe(`bash tool - background execution [${provider.name}]`, () => {
    let remote: RemoteInstance;

    beforeAll(async () => {
      remote = await provider.connect();
    });

    afterAll(async () => {
      await provider.disconnect(remote);
    });

    it('should start a background command and return shell ID', async () => {
      const result = await remote.bash.handler({
        command: 'echo "background task" && sleep 0.5',
        run_in_background: true,
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.shellId).toBeDefined();
      expect(typeof result.structuredContent?.shellId).toBe('string');
    });

    it('should retrieve output from background shell', async () => {
      const startResult = await remote.bash.handler({
        command: 'echo "Hello from background"',
        run_in_background: true,
      });

      expect(startResult.isError).not.toBe(true);
      const { shellId } = startResult.structuredContent!;
      expect(shellId).toBeDefined();

      // Wait a bit for command to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const outputResult = await remote.bashOutput.handler({
        shell_id: shellId!,
      });

      expect(outputResult.isError).not.toBe(true);
      expect(outputResult.content[0].text).toContain('Hello from background');
    });

    it('should report running status for long-running background command', async () => {
      const startResult = await remote.bash.handler({
        command: 'sleep 2',
        run_in_background: true,
      });

      expect(startResult.isError).not.toBe(true);
      const { shellId } = startResult.structuredContent!;

      const outputResult = await remote.bashOutput.handler({
        shell_id: shellId!,
      });

      expect(outputResult.isError).not.toBe(true);
      expect(outputResult.structuredContent?.status).toBe('running');
    });

    it('should report completed status when background command finishes', async () => {
      const startResult = await remote.bash.handler({
        command: 'echo "quick task"',
        run_in_background: true,
      });

      expect(startResult.isError).not.toBe(true);
      const { shellId } = startResult.structuredContent!;

      // Wait for command to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      const outputResult = await remote.bashOutput.handler({
        shell_id: shellId!,
      });

      expect(outputResult.isError).not.toBe(true);
      expect(outputResult.structuredContent?.status).toBe('completed');
      expect(outputResult.structuredContent?.exitCode).toBe(0);
    });

    it('should only return new output on subsequent checks', async () => {
      const startResult = await remote.bash.handler({
        command: 'echo "first" && sleep 0.2 && echo "second"',
        run_in_background: true,
      });

      expect(startResult.isError).not.toBe(true);
      const { shellId } = startResult.structuredContent!;

      // First check
      await new Promise((resolve) => setTimeout(resolve, 100));
      const firstCheck = await remote.bashOutput.handler({
        shell_id: shellId!,
      });
      expect(firstCheck.isError).not.toBe(true);
      expect(firstCheck.content[0].text).toContain('first');

      // Second check - should only get new output
      await new Promise((resolve) => setTimeout(resolve, 200));
      const secondCheck = await remote.bashOutput.handler({
        shell_id: shellId!,
      });
      expect(secondCheck.isError).not.toBe(true);
      expect(secondCheck.content[0].text).not.toContain('first');
      expect(secondCheck.content[0].text).toContain('second');
    });

    it('should handle multiple background shells concurrently', async () => {
      const result1 = await remote.bash.handler({
        command: 'echo "shell 1" && sleep 0.3',
        run_in_background: true,
      });
      const result2 = await remote.bash.handler({
        command: 'echo "shell 2" && sleep 0.3',
        run_in_background: true,
      });

      expect(result1.isError).not.toBe(true);
      expect(result2.isError).not.toBe(true);

      const { shellId: shellId1 } = result1.structuredContent!;
      const { shellId: shellId2 } = result2.structuredContent!;

      expect(shellId1).not.toBe(shellId2);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const output1 = await remote.bashOutput.handler({
        shell_id: shellId1!,
      });
      const output2 = await remote.bashOutput.handler({
        shell_id: shellId2!,
      });

      expect(output1.isError).not.toBe(true);
      expect(output2.isError).not.toBe(true);
      expect(output1.content[0].text).toContain('shell 1');
      expect(output2.content[0].text).toContain('shell 2');
    });

    it('should kill a running background shell', async () => {
      const startResult = await remote.bash.handler({
        command: 'sleep 10',
        run_in_background: true,
      });

      expect(startResult.isError).not.toBe(true);
      const { shellId } = startResult.structuredContent!;

      const killResult = await remote.killBash.handler({
        shell_id: shellId!,
      });

      expect(killResult.isError).not.toBe(true);
      expect(killResult.structuredContent?.killed).toBe(true);

      // Check that shell is no longer running
      const outputResult = await remote.bashOutput.handler({
        shell_id: shellId!,
      });

      expect(outputResult.isError).not.toBe(true);
      expect(outputResult.structuredContent?.status).toBe('completed');
    });

    it('should handle kill with custom signal', async () => {
      const startResult = await remote.bash.handler({
        command: 'sleep 10',
        run_in_background: true,
      });

      expect(startResult.isError).not.toBe(true);
      const { shellId } = startResult.structuredContent!;

      const killResult = await remote.killBash.handler({
        shell_id: shellId!,
        signal: 'SIGKILL',
      });

      expect(killResult.isError).not.toBe(true);
      expect(killResult.structuredContent?.killed).toBe(true);
    });

    it('should handle non-existent shell ID gracefully', async () => {
      const killResult = await remote.killBash.handler({
        shell_id: 'nonexistent-shell-id-12345',
      });

      expect(killResult.isError).not.toBe(true);
      expect(killResult.structuredContent?.killed).toBe(false);
    });

    it('should capture exit code for failed background command', async () => {
      const startResult = await remote.bash.handler({
        command: 'false',
        run_in_background: true,
      });

      expect(startResult.isError).not.toBe(true);
      const { shellId } = startResult.structuredContent!;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const outputResult = await remote.bashOutput.handler({
        shell_id: shellId!,
      });

      expect(outputResult.isError).not.toBe(true);
      expect(outputResult.structuredContent?.status).toBe('completed');
      expect(outputResult.structuredContent?.exitCode).toBe(1);
    });
  });
}
