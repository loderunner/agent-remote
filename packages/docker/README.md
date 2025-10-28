# @agent-remote/docker

Docker remote tools for AI agents. Execute commands and manage files on Docker
containers.

## Installation

```bash
npm install @agent-remote/docker
```

## Usage

### Library

```typescript
import { Remote } from '@agent-remote/docker';

// Create a remote instance
const remote = new Remote({
  container: 'my-app',
  shell: 'bash', // optional, defaults to 'sh'
});

// Execute commands
const result = await remote.bash.handler({ command: 'ls -la' });
console.log(result.content[0].text);

// Read files
const file = await remote.read.handler({ file_path: '/app/config.json' });
console.log(file.content[0].text);

// Write files
await remote.write.handler({
  file_path: '/app/output.txt',
  content: 'Hello from Docker!',
});

// Edit files
await remote.edit.handler({
  file_path: '/app/config.json',
  old_string: '"debug": false',
  new_string: '"debug": true',
});

// Search files
const matches = await remote.grep.handler({
  pattern: 'TODO',
  path: '/app/src',
});

// Find files
const files = await remote.glob.handler({
  base_path: '/app',
  pattern: '**/*.ts',
});
```

### MCP Server

Run as an MCP server for use with Claude Desktop or other MCP clients:

```bash
# Using container name
remote-docker-mcp --container my-app

# With custom shell
remote-docker-mcp --container my-app --shell bash

# Using environment variables
DOCKER_CONTAINER=my-app remote-docker-mcp
```

#### Configuration in Claude Desktop

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

## Configuration

### RemoteConfig

- `container` (required): Name of the Docker container to execute commands on
- `shell` (optional): Shell to use for command execution (default: `'sh'`)
  - Common options: `'sh'`, `'bash'`, `'zsh'`, `'dash'`
  - The default `'sh'` uses whatever shell is symlinked as `/bin/sh` in the
    container

## Features

- **Persistent shell sessions**: Maintains state (working directory, environment
  variables) between foreground commands
- **Background command execution**: Run long-running commands in the background
  and retrieve output later
- **File operations**: Read, write, and edit files with unified diff output
- **Search capabilities**: Grep for patterns and glob for file matching
- **Configurable shell**: Use any shell available in your container
- **Zero setup**: Works with any running Docker container

## Requirements

- Docker must be installed and accessible via the `docker` command
- The target container must be running
- Basic Unix tools should be available in the container (sh, cat, find, grep)

## License

Apache-2.0


