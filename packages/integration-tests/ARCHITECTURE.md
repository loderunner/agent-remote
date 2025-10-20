# Integration Tests Architecture

This document explains how the shared integration test suite architecture works.

## Overview

The integration tests package provides a **provider pattern** for testing
multiple remote execution implementations against the same test suite. This
ensures all implementations (SSH, Container, etc.) have identical behavior.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  @claude-remote/integration-tests                │
│                         (private package)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐          ┌──────────────────────────┐      │
│  │ RemoteProvider  │          │     Test Suites          │      │
│  │   Interface     │◄─────────┤                          │      │
│  └─────────────────┘          │  - bashForeground()      │      │
│                               │  - bashBackground()      │      │
│  ┌─────────────────┐          │  - file()                │      │
│  │ RemoteInstance  │          │  - grep()                │      │
│  │   Interface     │          │  - glob()                │      │
│  └─────────────────┘          │                          │      │
│                               │  runAllSuites(provider)  │      │
│                               └──────────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ▲                    ▲
                              │                    │
                              │                    │
        ┌─────────────────────┴──────┐   ┌─────────┴──────────────┐
        │                            │   │                        │
┌───────▼──────────┐        ┌────────▼───▼────────┐      ┌───────▼──────────┐
│  @claude-remote/ │        │  @claude-remote/    │      │  @claude-remote/ │
│      ssh         │        │     container       │      │    kubernetes    │
│                  │        │   (future)          │      │    (future)      │
├──────────────────┤        ├─────────────────────┤      ├──────────────────┤
│                  │        │                     │      │                  │
│ SSH Provider ────┤        │ Container Provider ─┤      │  K8s Provider ───┤
│   Implementation │        │    Implementation   │      │   Implementation │
│                  │        │                     │      │                  │
│ ✓ Implemented    │        │ ⏳ Not yet          │      │ ⏳ Not yet        │
│                  │        │                     │      │                  │
└──────────────────┘        └─────────────────────┘      └──────────────────┘
```

## File Structure

```
packages/
├── integration-tests/              # Shared test suite (PRIVATE)
│   ├── src/
│   │   ├── provider.ts            # Provider interface definitions
│   │   ├── suites/                # Individual test suites
│   │   │   ├── bash-foreground.suite.ts
│   │   │   ├── bash-background.suite.ts
│   │   │   ├── file.suite.ts
│   │   │   ├── grep.suite.ts
│   │   │   ├── glob.suite.ts
│   │   │   └── index.ts
│   │   └── index.ts               # Main entry point (runAllSuites)
│   └── package.json               # private: true
│
├── ssh/                            # SSH implementation
│   ├── src/
│   │   └── lib/
│   │       └── remote.ts          # Remote class with tool handlers
│   └── tests/
│       ├── provider/
│       │   └── ssh-provider.ts    # SSH provider adapter
│       └── integration/
│           └── remote.integration.test.ts  # Runs shared tests
│
└── container/                      # Future container implementation
    ├── src/
    │   └── lib/
    │       └── remote.ts          # Same handler interface
    └── tests/
        ├── provider/
        │   └── container-provider.ts  # Container provider adapter
        └── integration/
            └── remote.integration.test.ts  # Same shared tests!
```

## How It Works

### 1. Provider Interface

Each implementation provides a `RemoteProvider` that knows how to:

- **Connect** to the remote system
- **Disconnect** from the remote system
- **Get test environment** configuration (fixture paths, etc.)

```typescript
type RemoteProvider = {
  name: string;
  connect: () => Promise<RemoteInstance>;
  disconnect: (remote: RemoteInstance) => Promise<void>;
  getTestEnvironment: () => TestEnvironment;
};
```

### 2. Remote Instance Interface

The provider returns a `RemoteInstance` which exposes standardized tool
handlers:

```typescript
type RemoteInstance = {
  bash: { handler: (input) => Promise<CallToolResult> };
  read: { handler: (input) => Promise<CallToolResult> };
  write: { handler: (input) => Promise<CallToolResult> };
  edit: { handler: (input) => Promise<CallToolResult> };
  grep: { handler: (input) => Promise<CallToolResult> };
  glob: { handler: (input) => Promise<CallToolResult> };
  // ... etc
};
```

### 3. Test Suites

Each test suite is a function that accepts a `RemoteProvider`:

```typescript
export function bashForegroundSuite(provider: RemoteProvider) {
  describe(`bash tool - foreground [${provider.name}]`, () => {
    let remote: RemoteInstance;

    beforeAll(async () => {
      remote = await provider.connect();
    });

    afterAll(async () => {
      await provider.disconnect(remote);
    });

    it('should execute a simple command', async () => {
      const result = await remote.bash.handler({
        command: 'echo "hello"',
      });
      expect(result.content[0].text).toContain('hello');
    });

    // ... many more tests
  });
}
```

### 4. Running Tests

Each implementation creates a provider adapter and runs the shared tests:

```typescript
// packages/ssh/tests/integration/remote.integration.test.ts
import { runAllSuites } from '@claude-remote/integration-tests';
import { createSshProvider } from '../provider/ssh-provider';

runAllSuites(createSshProvider());
```

## Benefits

1. **Single source of truth** - All behavior tests are defined once
2. **Consistent behavior** - All implementations pass the same tests
3. **Easy to extend** - New implementations just need a provider adapter
4. **Maintainable** - Fix a test once, all implementations benefit
5. **Documentation** - Tests serve as behavior specification
6. **Confidence** - Know that SSH and Container behave identically

## Adding a New Implementation

To add a new remote execution backend (e.g., Container, Kubernetes):

1. **Create the package** - `packages/container/`
2. **Implement Remote class** - With the same handler signatures
3. **Create provider adapter** - `tests/provider/container-provider.ts`
4. **Run shared tests** - Import and call `runAllSuites()`
5. **Done!** - All tests run against your implementation

Example provider:

```typescript
export function createContainerProvider(): RemoteProvider {
  return {
    name: 'Container',
    connect: async () => await ContainerRemote.connect({ ... }),
    disconnect: async (remote) => await remote.disconnect(),
    getTestEnvironment: () => ({
      fixturesPath: '/home/dev/fixtures',
      testFilesPath: '/home/dev/test-files',
    }),
  };
}
```

## Test Environment

All implementations test against the same sandbox environment:

- **Fixtures** (`/home/dev/fixtures`) - Read-only test data
- **Test files** (`/home/dev/test-files`) - Writable temp directory

This ensures identical test conditions across all implementations.

## Alternative Architectures Considered

See the main conversation for other patterns that were considered:

1. ✅ **Provider Pattern** (chosen) - Clean separation, composition over inheritance
2. ❌ **Contract Testing** - More verbose, data-driven approach
3. ❌ **Abstract Base Class** - Inheritance, less flexible

The provider pattern was chosen for its simplicity and flexibility.
