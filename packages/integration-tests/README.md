# @claude-remote/integration-tests

Shared integration test suites for remote execution packages. This package
provides a common set of tests that verify remote implementation behavior
across different backends (SSH, Container, etc.).

**This package is private and not published to npm.**

## Purpose

When implementing remote execution backends (SSH, Docker containers, Kubernetes
pods, etc.), you want to ensure they all behave consistently. This package
provides a standard test suite that all implementations can run against,
ensuring they have identical behavior and API contracts.

## Usage

### Running All Tests

```typescript
import { runAllSuites } from '@claude-remote/integration-tests';
import { createYourProvider } from './your-provider';

runAllSuites(createYourProvider());
```

### Running Individual Test Suites

```typescript
import { suites } from '@claude-remote/integration-tests';
import { createYourProvider } from './your-provider';

const provider = createYourProvider();

suites.bashForeground(provider);
suites.file(provider);
suites.grep(provider);
```

## Implementing a Provider

Your provider must implement the `RemoteProvider` interface:

```typescript
import type { RemoteProvider } from '@claude-remote/integration-tests';
import { YourRemote } from './your-remote';

export function createYourProvider(): RemoteProvider {
  return {
    name: 'YourImplementation',

    connect: async () => {
      const remote = await YourRemote.connect({
        // Your connection config
      });
      return remote;
    },

    disconnect: async (remote) => {
      await remote.disconnect();
    },

    getTestEnvironment: () => ({
      fixturesPath: '/path/to/test/fixtures',
      testFilesPath: '/path/to/temp/files',
    }),
  };
}
```

## Test Environment Requirements

Your test environment must have:

1. **Fixtures directory** - Read-only test files:
   - `simple.txt` - Simple text file with numbered lines
   - `log.txt` - Log file with various log levels
   - `mixed-case.txt` - File with mixed case text
   - `code/app.js` - JavaScript file
   - `code/config.py` - Python config file
   - `docs/README.md` - Markdown file
   - `docs/API.md` - API documentation
   - `nested/deep/nested-file.txt` - Deeply nested file
   - `empty/` - Empty directory

2. **Test files directory** - Writable directory for temporary test files

See the `sandbox/fixtures` directory in this repository for the expected fixture
structure.

## Test Suites

### Bash Foreground

Tests foreground command execution:

- Simple commands
- Exit codes
- Output capture
- Pipes and redirects
- Environment variables
- Timeouts

### Bash Background

Tests background process management:

- Shell ID handling
- Output retrieval
- Process status
- Concurrent shells
- Process termination

### File Operations

Tests file read/write/edit:

- Reading files (full, partial, with offsets)
- Writing new files
- Overwriting existing files
- Editing files (single/multiple replacements)
- Diff generation
- Round-trip consistency

### Grep

Tests pattern searching:

- Different output modes (files, content, count)
- Line numbers and context
- Case sensitivity
- Glob filters
- Regex patterns
- Empty results

### Glob

Tests file pattern matching:

- Simple patterns
- Globstar (`**`)
- Multiple extensions
- Nested directories
- Empty results

## License

UNLICENSED
