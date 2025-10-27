# Integration Tests

This package contains generic integration tests for Claude remote tool
implementations.

## Purpose

The integration tests are designed to be implementation-agnostic, allowing them
to test multiple remote implementations (SSH, Docker, etc.) with the same test
suite. Each test is parameterized to run against all available implementations
of each tool type.

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

## Prerequisites

Tests require the SSH sandbox to be running:

```bash
# From the repository root
cd sandbox
docker-compose up -d
```

## Adding New Implementations

To add tests for a new remote implementation:

1. Update `src/setup.ts` to add setup/teardown functions and getter functions
   for the new connection
2. In each test file, add new factory entries to the `implementations` array

Example structure in `src/setup.ts`:

```typescript
let newConnection: RemoteConnection;

export async function setupNewRemote(): Promise<void> {
  newConnection = await createConnection();
}

export function teardownNewRemote(): void {
  newConnection?.close();
}

export function getNewConnection(): RemoteConnection {
  return newConnection;
}
```

Example usage in test files (e.g., `src/file.test.ts`):

```typescript
const implementations: Array<{
  name: string;
  createFileTool: () => FileTool;
}> = [
  {
    name: 'ssh-sftp',
    createFileTool: () => new FileTool(getSSHSFTP()),
  },
  {
    name: 'new-remote',
    createFileTool: () => new FileTool(getNewConnection()),
  },
];
```

The existing test cases will automatically run against all implementations using
`describe.each()`.
