import { Client } from 'ssh2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BashTool } from './bash';

/**
 * Unit tests specific to SSH BashTool implementation
 */

let client: Client;

async function setupSSH(): Promise<void> {
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
}

function teardownSSH(): void {
  client?.end();
}

describe('SSH BashTool - Unit Tests', () => {
  beforeAll(async () => {
    await setupSSH();
  });

  afterAll(() => {
    teardownSSH();
  });

  describe('Event Listener Management', () => {
    it('should not leak event listeners after multiple executions', async () => {
      const bashTool = new BashTool(client);
      const shell = await bashTool.init();

      // Get initial listener counts
      const initialDataListeners = shell.listenerCount('data');
      const initialErrorListeners = shell.listenerCount('error');

      // Run multiple commands
      for (let i = 0; i < 5; i++) {
        await bashTool.execute({ command: `echo "test ${i}"` });
      }

      // Verify listener counts haven't increased
      expect(shell.listenerCount('data')).toBe(initialDataListeners);
      expect(shell.listenerCount('error')).toBe(initialErrorListeners);
    });
  });
});


