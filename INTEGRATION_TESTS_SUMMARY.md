# Reusable Integration Tests Architecture - Summary

This document provides an overview of the shared integration testing architecture
for remote execution implementations.

## What Was Built

A **shared integration test suite** that can be reused across different remote
execution backends (SSH, Container, Kubernetes, etc.) to ensure they all have
identical behavior and API contracts.

## Architecture Choice

**Option 1: Provider Pattern** (from the original proposal)

- Clean separation of concerns
- Composition over inheritance
- Easy to understand and extend
- Type-safe with TypeScript
- No coupling between test suite and implementations

## Package Structure

```
packages/
├── integration-tests/          # NEW: Shared test suite (PRIVATE)
│   ├── package.json           # private: true
│   ├── README.md              # Usage documentation
│   ├── ARCHITECTURE.md        # Architecture details
│   ├── src/
│   │   ├── provider.ts        # Provider interface
│   │   ├── suites/            # Individual test suites
│   │   │   ├── bash-foreground.suite.ts
│   │   │   ├── bash-background.suite.ts
│   │   │   ├── file.suite.ts
│   │   │   ├── grep.suite.ts
│   │   │   ├── glob.suite.ts
│   │   │   └── index.ts
│   │   └── index.ts           # Main entry: runAllSuites()
│   └── examples/
│       └── container-example.ts  # Template for future impls
│
├── ssh/                        # UPDATED: Now uses shared tests
│   ├── tests/                 # NEW: Test directory
│   │   ├── provider/
│   │   │   └── ssh-provider.ts
│   │   └── integration/
│   │       └── remote.integration.test.ts
│   └── (existing files unchanged)
│
└── container/                  # FUTURE: Not yet implemented
    ├── src/lib/remote.ts      # Same handler interface
    └── tests/
        ├── provider/container-provider.ts
        └── integration/remote.integration.test.ts
```

## Key Components

### 1. Provider Interface (`integration-tests/src/provider.ts`)

```typescript
type RemoteProvider = {
  name: string;
  connect: () => Promise<RemoteInstance>;
  disconnect: (remote: RemoteInstance) => Promise<void>;
  getTestEnvironment: () => TestEnvironment;
};

type RemoteInstance = {
  bash: { handler: ToolHandler };
  read: { handler: ToolHandler };
  write: { handler: ToolHandler };
  // ... all other tools
};
```

### 2. Test Suites (`integration-tests/src/suites/*.suite.ts`)

Each suite is a function that accepts a provider and runs tests:

- `bashForegroundSuite()` - Foreground command execution
- `bashBackgroundSuite()` - Background process management
- `fileSuite()` - File read/write/edit operations
- `grepSuite()` - Pattern searching
- `globSuite()` - File pattern matching

### 3. Main Entry Point (`integration-tests/src/index.ts`)

```typescript
export function runAllSuites(provider: RemoteProvider) {
  bashForegroundSuite(provider);
  bashBackgroundSuite(provider);
  fileSuite(provider);
  grepSuite(provider);
  globSuite(provider);
}
```

### 4. SSH Provider Adapter (`ssh/tests/provider/ssh-provider.ts`)

```typescript
export function createSshProvider(): RemoteProvider {
  return {
    name: 'SSH',
    connect: async () => await Remote.connect({ ... }),
    disconnect: async (remote) => await remote.disconnect(),
    getTestEnvironment: () => ({
      fixturesPath: '/home/dev/fixtures',
      testFilesPath: '/home/dev/test-files',
    }),
  };
}
```

### 5. SSH Integration Test (`ssh/tests/integration/remote.integration.test.ts`)

```typescript
import { runAllSuites } from '@claude-remote/integration-tests';
import { createSshProvider } from '../provider/ssh-provider';

runAllSuites(createSshProvider());
```

## How It Works

1. **Define once** - All integration tests live in `integration-tests` package
2. **Provider pattern** - Each implementation creates a simple adapter
3. **Run everywhere** - Same tests run against SSH, Container, etc.
4. **Type-safe** - TypeScript ensures all handlers match the contract
5. **Maintainable** - Update tests once, all implementations benefit

## Usage Example

### For Existing SSH Package

```bash
cd packages/ssh
pnpm test:integration  # Runs shared integration tests via SSH
```

### For Future Container Package

```typescript
// 1. Implement your Remote class with same handler signatures
export class Remote {
  get bash(): BashToolDefinition { ... }
  get read(): ReadToolDefinition { ... }
  // ... etc
}

// 2. Create provider adapter
export function createContainerProvider(): RemoteProvider {
  return {
    name: 'Container',
    connect: async () => await Remote.connect({ containerId: 'test' }),
    disconnect: async (remote) => await remote.disconnect(),
    getTestEnvironment: () => ({ ... }),
  };
}

// 3. Run shared tests
import { runAllSuites } from '@claude-remote/integration-tests';
runAllSuites(createContainerProvider());
```

Done! All the same integration tests now verify your container implementation.

## Benefits

### For Maintainers

- **Single source of truth** - Fix bugs in tests once
- **Consistent behavior** - All implementations tested identically
- **Easy refactoring** - Change test suite, all impls get updates
- **Documentation** - Tests serve as behavior specification

### For Implementation Authors

- **Clear contract** - Know exactly what to implement
- **Ready-made tests** - Don't write integration tests from scratch
- **Confidence** - Know your implementation matches others
- **Fast development** - Just implement Remote class + provider adapter

### For Users

- **Consistent experience** - SSH and Container behave identically
- **Reliable** - All implementations tested thoroughly
- **Confidence** - Can switch backends without surprises

## Test Coverage

The shared test suite covers:

- ✅ Bash foreground execution (20+ tests)
- ✅ Bash background execution (10+ tests)
- ✅ File operations - read/write/edit (40+ tests)
- ✅ Grep search - all modes and flags (25+ tests)
- ✅ Glob pattern matching (8+ tests)

Total: **100+ integration tests** ready to use!

## Files Created

1. `packages/integration-tests/package.json` - Package config (private)
2. `packages/integration-tests/tsconfig.json` - TypeScript config
3. `packages/integration-tests/README.md` - Usage documentation
4. `packages/integration-tests/ARCHITECTURE.md` - Architecture details
5. `packages/integration-tests/.gitignore` - Git ignore
6. `packages/integration-tests/src/provider.ts` - Provider interface
7. `packages/integration-tests/src/suites/bash-foreground.suite.ts` - Bash foreground tests
8. `packages/integration-tests/src/suites/bash-background.suite.ts` - Bash background tests
9. `packages/integration-tests/src/suites/file.suite.ts` - File operation tests
10. `packages/integration-tests/src/suites/grep.suite.ts` - Grep search tests
11. `packages/integration-tests/src/suites/glob.suite.ts` - Glob matching tests
12. `packages/integration-tests/src/suites/index.ts` - Suite exports
13. `packages/integration-tests/src/index.ts` - Main entry point
14. `packages/integration-tests/examples/container-example.ts` - Future impl template
15. `packages/ssh/tests/provider/ssh-provider.ts` - SSH provider adapter
16. `packages/ssh/tests/integration/remote.integration.test.ts` - SSH integration test
17. `INTEGRATION_TESTS_SUMMARY.md` - This summary

## Changes to Existing Files

1. `packages/ssh/package.json` - Added `@claude-remote/integration-tests` dev dependency
2. `packages/ssh/vitest.config.ts` - Added `tests/**/*.integration.test.ts` to integration test glob

## Next Steps

When implementing a Container package:

1. Create `packages/container/` structure
2. Implement `Remote` class with same handler signatures
3. Create `tests/provider/container-provider.ts` adapter
4. Create `tests/integration/remote.integration.test.ts` that calls `runAllSuites()`
5. Run `pnpm test:integration` - all 100+ tests verify your implementation!

## Alternative Architectures Considered

See the main conversation for details on:

1. ✅ **Provider Pattern** (chosen) - What we built
2. ❌ **Contract Testing** - More verbose, data-driven
3. ❌ **Abstract Base Class** - Inheritance-based, less flexible

The provider pattern won for its simplicity, flexibility, and alignment with
TypeScript best practices (composition over inheritance).
