import type { RemoteProvider } from './provider';
import {
  bashBackgroundSuite,
  bashForegroundSuite,
  fileSuite,
  globSuite,
  grepSuite,
} from './suites';

export type { RemoteProvider, RemoteInstance, TestEnvironment } from './provider';

/**
 * Runs all integration test suites for a given remote provider.
 * This is the main entry point for testing remote implementations.
 *
 * @param provider - Remote provider implementation to test
 *
 * @example
 * ```typescript
 * import { runAllSuites } from '@claude-remote/integration-tests';
 * import { createSshProvider } from './ssh-provider';
 *
 * runAllSuites(createSshProvider());
 * ```
 */
export function runAllSuites(provider: RemoteProvider) {
  bashForegroundSuite(provider);
  bashBackgroundSuite(provider);
  fileSuite(provider);
  grepSuite(provider);
  globSuite(provider);
}

/**
 * Runs individual test suites. Use these when you want to run
 * specific test suites instead of all of them.
 */
export const suites = {
  bashForeground: bashForegroundSuite,
  bashBackground: bashBackgroundSuite,
  file: fileSuite,
  grep: grepSuite,
  glob: globSuite,
};
