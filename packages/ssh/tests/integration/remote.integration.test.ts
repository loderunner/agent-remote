import { runAllSuites } from '@claude-remote/integration-tests';

import { createSshProvider } from '../provider/ssh-provider';

// Run all shared integration test suites with SSH provider
runAllSuites(createSshProvider());
