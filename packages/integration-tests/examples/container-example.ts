// This is an example template showing how a future container package
// would use the shared integration tests.
//
// File: packages/container/tests/provider/container-provider.ts

import type {
  RemoteInstance,
  RemoteProvider,
} from '@claude-remote/integration-tests';

// import { Remote } from '../../src/lib/remote';

/**
 * Creates a Container remote provider for integration tests.
 * Connects to a Docker container or similar.
 *
 * @returns Container remote provider instance
 */
export function createContainerProvider(): RemoteProvider {
  return {
    name: 'Container',

    connect: async (): Promise<RemoteInstance> => {
      // const remote = await Remote.connect({
      //   containerId: 'test-container',
      //   // Or other container-specific config
      // });
      //
      // return remote as unknown as RemoteInstance;

      throw new Error('Not implemented - this is just an example');
    },

    disconnect: async (remote: RemoteInstance): Promise<void> => {
      // await (remote as unknown as Remote).disconnect();

      throw new Error('Not implemented - this is just an example');
    },

    getTestEnvironment: () => ({
      // Same fixture paths as SSH - testing against same sandbox
      fixturesPath: '/home/dev/fixtures',
      testFilesPath: '/home/dev/test-files',
    }),
  };
}

// File: packages/container/tests/integration/remote.integration.test.ts
//
// import { runAllSuites } from '@claude-remote/integration-tests';
// import { createContainerProvider } from '../provider/container-provider';
//
// // Run all shared integration test suites with Container provider
// runAllSuites(createContainerProvider());
