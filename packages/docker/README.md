# @agent-remote/docker

A TypeScript library for executing commands and managing files on Docker
containers. Designed for integration with the Claude Agent SDK to provide AI
agents with container access.

## Features

- **Bash execution** - Run commands in persistent shell sessions with background
  execution support
- **File operations** - Read, write, and edit files remotely using shell
  commands
- **Search tools** - Grep pattern search and glob file matching
- **Type-safe** - Full TypeScript support with Zod validation
- **Agent SDK integration** - Easy integration with Claude Agent SDK via MCP
  server
- **Standalone MCP server** - Run as a standalone MCP server with stdio
  transport
- **Zero setup** - Works with any running Docker container

## Installation

```bash
npm install @agent-remote/docker
```

## Quick Start

### MCP Server (Standalone)

The package includes a standalone MCP server executable that can be run from the
command line and communicates over stdio transport. The server is self-contained
with all dependencies bundled (except Node.js builtins), making it easy to
distribute and run without installing node_modules.

**Installation:**

```bash
npm install -g @agent-remote/docker
```

**Usage with command line arguments:**

```bash
# With container name
remote-docker-mcp --container my-app

# With custom shell
remote-docker-mcp --container my-app --shell bash
```

**Usage with environment variables:**

```bash
export DOCKER_CONTAINER=my-app
export DOCKER_SHELL=bash
remote-docker-mcp
```

**Available options:**

- `--container, -c` - Docker container name (or `DOCKER_CONTAINER` env var)
- `--shell, -s` - Shell to use for command execution, default 'sh' (or
  `DOCKER_SHELL` env var)
- `--debug` - Enable debug output

The server exposes all remote tools (bash, read, write, edit, grep, glob, etc.)
through the MCP protocol.

**Configuration in Claude Desktop:**

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "docker": {
      "command": "remote-docker-mcp",
      "args": ["--container", "my-app"]
    }
  }
}
```

### Basic Usage

```typescript
import { Remote } from '@agent-remote/docker';

// Create a remote instance
const remote = new Remote({
  container: 'my-app',
  shell: 'bash', // optional, defaults to 'sh'
});

// Execute commands
const result = await remote.bash.handler({
  command: 'ls -la',
});
console.log(result.content[0].text);

// Read files
const fileContent = await remote.read.handler({
  file_path: '/app/config.json',
});

// Write files
await remote.write.handler({
  file_path: '/tmp/test.txt',
  content: 'Hello, world!',
});
```

### Using with Claude Agent SDK

```typescript
import { Remote } from '@agent-remote/docker';

const remote = new Remote({
  container: 'my-app',
  shell: 'bash',
});

// Create an MCP server with all tools
const server = remote.createSdkMcpServer();

// Use with Agent SDK...
```

### Using Individual Tools

```typescript
const remote = new Remote({ container: 'my-app' });

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
  name: 'custom-remote-docker',
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

The main class for managing Docker container access and tools.

#### Constructor

##### `new Remote(config: RemoteConfig)`

Creates a new Remote instance for interacting with a Docker container.

**Parameters:**

- `config` - Docker container configuration (see Configuration below)

**Returns:** A `Remote` instance

**Example:**

```typescript
const remote = new Remote({
  container: 'my-app',
  shell: 'bash',
});
```

#### Instance Methods

##### `createSdkMcpServer(name?: string)`

Creates an MCP server with all remote tools from this Remote instance.

**Parameters:**

- `name` - Optional name for the MCP server (defaults to 'remote-docker')

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

Reads files from the container filesystem using shell commands.

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

**Implementation:**

Uses `cat` command to read file contents from the container.

##### `write: WriteToolDefinition`

Writes content to files on the container filesystem using shell commands.

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
  content: string; // Content that was written
}
```

**Implementation:**

Uses `printf '%s' '...'` with single-quote escaping to safely handle special
characters, newlines, and unicode.

##### `edit: EditToolDefinition`

Edits files by replacing text on the container filesystem using shell commands.

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

**Implementation:**

Uses `cat` to read, performs replacement locally, then uses `printf` to write
back.

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

## Configuration

### RemoteConfig

The configuration object for creating a Remote instance:

```typescript
{
  container: string;  // Name of the Docker container (required)
  shell?: string;     // Shell to use (default: 'sh')
}
```

**Shell options:**

- `'sh'` - Default, uses whatever shell is symlinked as `/bin/sh` in the
  container
- `'bash'` - Bash shell (must be available in container)
- `'zsh'` - Zsh shell (must be available in container)
- `'dash'` - Dash shell (must be available in container)

**Example:**

```typescript
const remote = new Remote({
  container: 'my-app',
  shell: 'bash',
});
```

## Examples

### Error Handling

```typescript
const remote = new Remote({ container: 'my-app' });

const result = await remote.bash.handler({
  command: 'some-command',
});

if (result.isError) {
  console.error('Command failed:', result.content[0].text);
} else {
  console.log('Success:', result.content[0].text);
}
```

### Background Command Execution

```typescript
const remote = new Remote({ container: 'my-app' });

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
const remote = new Remote({ container: 'my-app' });

// Find all TypeScript files
const files = await remote.glob.handler({
  base_path: '/app',
  pattern: '**/*.ts',
});

// Search for a pattern
const matches = await remote.grep.handler({
  pattern: 'TODO',
  path: '/app/src',
  glob: '*.ts',
  output_mode: 'content',
  '-n': true,
});

// Edit a file
await remote.edit.handler({
  file_path: '/app/config.ts',
  old_string: 'localhost',
  new_string: 'example.com',
  replace_all: true,
});
```

## Requirements

- Docker must be installed and accessible via the `docker` command
- The target container must be running
- Basic Unix tools should be available in the container (sh, cat, find, grep)

## License

Apache-2.0
