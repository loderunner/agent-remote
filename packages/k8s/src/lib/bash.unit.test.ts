import { describe, expect, it } from 'vitest';

import { BashTool } from './bash';

/**
 * Unit tests specific to K8s BashTool implementation
 */

describe('K8s BashTool - Unit Tests', () => {
  describe('Event Listener Management', () => {
    it('should not leak event listeners after multiple executions', async () => {
      const bashTool = new BashTool({ 
        pod: 'sandbox', 
        namespace: 'default',
        shell: 'sh',
      });

      // Execute init to get the shell process
      const shell = await bashTool.init();

      // Get initial listener counts
      const initialStdoutListeners = shell.stdout.listenerCount('data');
      const initialStderrListeners = shell.stderr.listenerCount('data');
      const initialErrorListeners = shell.listenerCount('error');

      // Run multiple commands
      for (let i = 0; i < 5; i++) {
        await bashTool.execute({ command: `echo "test ${i}"` });
      }

      // Verify listener counts haven't increased
      expect(shell.stdout.listenerCount('data')).toBe(initialStdoutListeners);
      expect(shell.stderr.listenerCount('data')).toBe(initialStderrListeners);
      expect(shell.listenerCount('error')).toBe(initialErrorListeners);
    });
  });
});
