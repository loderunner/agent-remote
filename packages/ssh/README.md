# @claude-remote/ssh

SSH remote tools for Claude AI agents. Execute commands, read/write files, and
search on remote systems via SSH.

## Features

- **Bash execution** - Run commands in persistent shell sessions
- **File operations** - Read, write, and edit files remotely
- **Search tools** - Grep and glob pattern matching
- **Type-safe** - Full TypeScript support with Zod validation

## Installation

```bash
pnpm add @claude-remote/ssh
```

## Usage

```typescript
import { connect } from '@claude-remote/ssh';

const { tools, disconnect } = await connect({
  host: 'example.com',
  username: 'user',
  password: 'password', // or use privateKey
});

// Use tools with Claude Agent SDK or standalone
await tools.bash.handler({ command: 'ls -la' });
await tools.read.handler({ file_path: '/etc/hosts' });

// Clean up when done
disconnect();
```

## Tools Available

- `bash` - Execute commands in a persistent shell
- `bash-output` - Get output from background shells
- `kill-bash` - Kill a running shell
- `grep` - Search for patterns in files
- `read` - Read file contents
- `write` - Write to files
- `edit` - Edit files with search/replace
- `glob` - Find files matching patterns

## License

UNLICENSED

