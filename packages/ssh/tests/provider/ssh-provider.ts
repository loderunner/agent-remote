import type {
  RemoteInstance,
  RemoteProvider,
} from '@claude-remote/integration-tests';

import { Remote } from '../../src/lib/remote';

/**
 * Creates an SSH remote provider for integration tests.
 * Connects to localhost:2222 with dev/dev credentials.
 *
 * @returns SSH remote provider instance
 */
export function createSshProvider(): RemoteProvider {
  return {
    name: 'SSH',

    connect: async (): Promise<RemoteInstance> => {
      const remote = await Remote.connect({
        host: 'localhost',
        port: 2222,
        username: 'dev',
        password: 'dev',
      });

      return remote as unknown as RemoteInstance;
    },

    disconnect: async (remote: RemoteInstance): Promise<void> => {
      await (remote as unknown as Remote).disconnect();
    },

    getTestEnvironment: () => ({
      fixturesPath: '/home/dev/fixtures',
      testFilesPath: '/home/dev/test-files',
    }),
  };
}
