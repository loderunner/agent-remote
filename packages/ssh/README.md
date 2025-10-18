# @claude-remote/ssh

A TypeScript library for executing commands and managing files on remote systems
via SSH. Designed for integration with the Claude Agent SDK to provide AI agents
with remote system access.

## Features

- **Bash execution** - Run commands in persistent shell sessions with background
  execution support
- **File operations** - Read, write, and edit files remotely via SFTP
- **Search tools** - Grep pattern search and glob file matching
- **Type-safe** - Full TypeScript support with Zod validation
- **Agent SDK integration** - Easy integration with Claude Agent SDK via MCP
  server
- **Standalone MCP server** - Run as a standalone MCP server with stdio
  transport

## Installation

```bash
pnpm add @claude-remote/ssh
```

## Quick Start

### MCP Server (Standalone)

The package includes a standalone MCP server that can be run from the command
line and communicate over stdio transport. This is useful for integrating with
MCP clients.

**Installation:**

```bash
npm install -g @claude-remote/ssh
```

**Usage with command line arguments:**

```bash
# With password authentication
ssh-mcp-server --host example.com --username user --password secret

# With private key authentication
ssh-mcp-server --host example.com --username user --private-key ~/.ssh/id_rsa

# With SSH agent
ssh-mcp-server --host example.com --username user --agent $SSH_AUTH_SOCK
```

**Usage with environment variables:**

```bash
export SSH_HOST=example.com
export SSH_USERNAME=user
export SSH_PRIVATE_KEY=~/.ssh/id_rsa
ssh-mcp-server
```

**Available options:**

- `--host, -h` - SSH host (or `SSH_HOST` env var)
- `--port, -p` - SSH port, default 22 (or `SSH_PORT` env var)
- `--username, -u` - SSH username (or `SSH_USERNAME` env var)
- `--password` - SSH password (or `SSH_PASSWORD` env var)
- `--private-key` - Path to private key file (or `SSH_PRIVATE_KEY` env var)
- `--passphrase` - Passphrase for encrypted private key (or `SSH_PASSPHRASE` env
  var)
- `--agent` - SSH agent socket path (or `SSH_AUTH_SOCK` env var)

The server exposes all remote tools (bash, read, write, edit, grep, glob, etc.)
through the MCP protocol.

### Basic Usage

```typescript
import { Remote } from '@claude-remote/ssh';

// Connect to remote server
const remote = await Remote.connect({
  host: 'example.com',
  username: 'user',
  privateKey: fs.readFileSync('/path/to/id_rsa'),
});

// Execute commands
const result = await remote.bash.handler({
  command: 'ls -la',
});
console.log(result.content[0].text);

// Read files
const fileContent = await remote.read.handler({
  file_path: '/etc/hosts',
});

// Write files
await remote.write.handler({
  file_path: '/tmp/test.txt',
  content: 'Hello, world!',
});

// Clean up
await remote.disconnect();
```

### Using with Claude Agent SDK

```typescript
import { Remote } from '@claude-remote/ssh';

const remote = await Remote.connect({
  host: 'example.com',
  username: 'user',
  privateKey: fs.readFileSync('/path/to/id_rsa'),
});

// Create an MCP server with all tools
const server = remote.createSdkMcpServer();

// Use with Agent SDK...
```

### Using Individual Tools

```typescript
const remote = await Remote.connect(config);

// Each tool is accessible as a property with a handler
const tools = [
  remote.bash,
  remote.bashOutput,
  remote.killBash,
  remote.grep,
  remote.read,
  remote.write,
  remote.edit,
  remote.glob,
];

// You can use individual tools in your own MCP server
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const customServer = createSdkMcpServer({
  name: 'custom-remote-ssh',
  version: '1.0.0',
  tools: [
    tool(
      remote.bash.name,
      remote.bash.description,
      remote.bash.inputSchema,
      remote.bash.handler,
    ),
    tool(
      remote.read.name,
      remote.read.description,
      remote.read.inputSchema,
      remote.read.handler,
    ),
    tool(
      remote.write.name,
      remote.write.description,
      remote.write.inputSchema,
      remote.write.handler,
    ),
  ],
});
```

## API Reference

### Remote Class

The main class for managing SSH connections and accessing tools.

#### Static Methods

##### `Remote.connect(config: ConnectConfig): Promise<Remote>`

Establishes a connection to a remote SSH server.

**Parameters:**

- `config` - SSH connection configuration (see SSH Configuration below)

**Returns:** A connected `Remote` instance

**Throws:** If the SSH connection or SFTP session fails

**Example:**

```typescript
const remote = await Remote.connect({
  host: 'example.com',
  username: 'user',
  password: 'secret',
});
```

#### Instance Methods

##### `disconnect(): Promise<void>`

Closes the SSH connection and SFTP session.

**Example:**

```typescript
await remote.disconnect();
```

##### `createSdkMcpServer()`

Creates an MCP server with all remote tools from this Remote instance.

**Returns:** An MCP server instance from the Claude Agent SDK

**Example:**

```typescript
const server = remote.createSdkMcpServer();
```

#### Tool Properties

Each tool is accessed via a getter property that returns a tool definition with
`name`, `description`, `inputSchema`, and `handler` properties.

##### `bash: BashToolDefinition`

Executes commands in a persistent shell session.

**Input:**

```typescript
{
  command: string;          // The command to execute
  timeout?: number;         // Optional timeout in milliseconds (max 600000)
  description?: string;     // Description of what the command does
  run_in_background?: boolean; // Run in background
}
```

**Output:**

```typescript
{
  output: string;    // Combined stdout and stderr
  exitCode?: number; // Exit code (optional)
  signal?: string;   // Signal used to terminate the command
  killed?: boolean;  // Whether the command was killed due to timeout
  shellId?: string;  // Shell ID if background execution
}
```

##### `bashOutput: BashOutputToolDefinition`

Retrieves output from a running or completed background bash shell.

**Input:**

```typescript
{
  shell_id: string; // Shell ID to retrieve output from
}
```

**Output:**

```typescript
{
  output: string;                  // New output since last check
  status: 'running' | 'completed'; // Shell status
  exitCode?: number;               // Exit code (when completed)
  signal?: string;                 // Signal (when completed)
}
```

##### `killBash: KillBashToolDefinition`

Kills a running background shell by its ID.

**Input:**

```typescript
{
  shell_id: string;         // Shell ID to kill
  signal?: string;          // Signal to send (e.g., 'SIGTERM', 'SIGKILL')
}
```

**Output:**

```typescript
{
  killed: boolean; // Whether the shell was killed
}
```

##### `grep: GrepToolDefinition`

Searches for patterns in files or directories.

**Input:**

```typescript
{
  pattern: string;          // Regular expression pattern
  path: string;             // File or directory to search
  glob?: string;            // Glob pattern to filter files
  output_mode?: 'content' | 'files_with_matches' | 'count';
  '-B'?: number;            // Lines of context before match
  '-A'?: number;            // Lines of context after match
  '-C'?: number;            // Lines of context before and after
  '-n'?: boolean;           // Show line numbers
  '-i'?: boolean;           // Case insensitive
  head_limit?: number;      // Limit output lines
}
```

**Output:**

```typescript
{
  mode: 'content' | 'files_with_matches' | 'count';
  content?: string;         // Matching lines (if mode is 'content')
  filenames?: string[];     // Matching files (if mode is 'files_with_matches')
  numFiles?: number;        // Number of files (if mode is 'files_with_matches')
  numMatches?: number;      // Number of matches (if mode is 'count')
}
```

##### `read: ReadToolDefinition`

Reads files from the remote filesystem.

**Input:**

```typescript
{
  file_path: string;        // Absolute path to file
  offset?: number;          // Line number to start reading from
  limit?: number;           // Number of lines to read
}
```

**Output:**

```typescript
{
  content: string; // File content
  numLines: number; // Number of lines read
  startLine: number; // Starting line number
  totalLines: number; // Total lines in file
}
```

##### `write: WriteToolDefinition`

Writes content to files on the remote filesystem.

**Input:**

```typescript
{
  file_path: string; // Absolute path to file
  content: string; // Content to write
}
```

**Output:**

```typescript
{
  bytes_written: number; // Number of bytes written
}
```

##### `edit: EditToolDefinition`

Edits files by replacing text on the remote filesystem.

**Input:**

```typescript
{
  file_path: string;        // Absolute path to file
  old_string: string;       // Text to find
  new_string: string;       // Text to replace with
  replace_all?: boolean;    // Replace all occurrences
}
```

**Output:**

```typescript
{
  replacements: number; // Number of replacements made
  diff: StructuredPatch; // Unified diff of changes
}
```

##### `glob: GlobToolDefinition`

Searches for files matching glob patterns.

**Input:**

```typescript
{
  base_path: string;        // Absolute base path to search from
  pattern: string;          // Glob pattern (e.g., '**/*.ts')
  include_hidden?: boolean; // Include hidden files
}
```

**Output:**

```typescript
{
  matches: string[];        // List of matching file paths
  count: number;            // Number of matches
}
```

## SSH Configuration

The `ConnectConfig` type from the [`ssh2`](https://github.com/mscdex/ssh2)
library supports various authentication methods:

### Password Authentication

```typescript
const remote = await Remote.connect({
  host: 'example.com',
  port: 22,
  username: 'user',
  password: 'secret',
});
```

### Private Key Authentication

```typescript
import fs from 'fs';

const remote = await Remote.connect({
  host: 'example.com',
  port: 22,
  username: 'user',
  privateKey: fs.readFileSync('/path/to/id_rsa'),
  passphrase: 'optional-passphrase', // If key is encrypted
});
```

### SSH Agent Authentication

```typescript
const remote = await Remote.connect({
  host: 'example.com',
  port: 22,
  username: 'user',
  agent: process.env.SSH_AUTH_SOCK,
});
```

### Advanced Options

```typescript
const remote = await Remote.connect({
  host: 'example.com',
  port: 22,
  username: 'user',
  privateKey: fs.readFileSync('/path/to/id_rsa'),
  keepaliveInterval: 10000,
  readyTimeout: 20000,
  algorithms: {
    kex: ['ecdh-sha2-nistp256'],
    cipher: ['aes128-ctr'],
  },
});
```

For all available configuration options, see the
[ssh2 documentation](https://github.com/mscdex/ssh2#client-methods).

## Examples

### Error Handling

```typescript
try {
  const remote = await Remote.connect(config);

  try {
    const result = await remote.bash.handler({
      command: 'some-command',
    });

    if (result.isError) {
      console.error('Command failed:', result.content[0].text);
    } else {
      console.log('Success:', result.content[0].text);
    }
  } finally {
    await remote.disconnect();
  }
} catch (error) {
  console.error('Connection failed:', error);
}
```

### Background Command Execution

```typescript
const remote = await Remote.connect(config);

// Start a long-running command in the background
const startResult = await remote.bash.handler({
  command: 'npm run build',
  run_in_background: true,
  description: 'Building project',
});

const { shellId } = startResult.structuredContent;

// Check output periodically
const checkOutput = async () => {
  const output = await remote.bashOutput.handler({ shell_id: shellId });
  console.log(output.content[0].text);

  if (output.structuredContent.status === 'running') {
    setTimeout(checkOutput, 1000);
  }
};

checkOutput();
```

### File Search and Edit

```typescript
const remote = await Remote.connect(config);

// Find all TypeScript files
const files = await remote.glob.handler({
  base_path: '/home/user/project',
  pattern: '**/*.ts',
});

// Search for a pattern
const matches = await remote.grep.handler({
  pattern: 'TODO',
  path: '/home/user/project',
  glob: '*.ts',
  output_mode: 'content',
  '-n': true,
});

// Edit a file
await remote.edit.handler({
  file_path: '/home/user/project/config.ts',
  old_string: 'localhost',
  new_string: 'example.com',
  replace_all: true,
});
```

## License

UNLICENSED
