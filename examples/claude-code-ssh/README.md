# Claude Code with Remote SSH Tools

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)

A configuration example for using Claude Code with remote systems via SSH. All
file operations and command executions happen on the remote machine instead of
your local filesystem.

## What This Example Does

This example configures Claude Code to:

- Connect to a remote SSH server via the MCP protocol
- Execute all bash commands on the remote system
- Read, write, and edit files remotely
- Search files with grep and glob patterns on the remote filesystem
- Disable local file/command tools to prevent accidental local operations

## Prerequisites

- Node.js 20+
- Access to an SSH server

## Installation

```bash
pnpm install
# or
npm install
```

## Configuration

This example is pre-configured to connect to the local sandbox server. To use
your own SSH server, edit `.mcp.json`:

| Argument        | Default                 | Description              |
| --------------- | ----------------------- | ------------------------ |
| `--host`        | `localhost`             | SSH server hostname      |
| `--port`        | `2222`                  | SSH server port          |
| `--username`    | `dev`                   | SSH username             |
| `--private-key` | `../../sandbox/ssh_key` | Path to private key file |

You can also use `--password` for password authentication or `--agent` for SSH
agent.

## Running the Example

### Launch Claude Code

```bash
pnpm start
# or
npm start
```

Claude Code will start with the remote SSH server connected. All file and
command operations will execute on the remote system.

## Example Tasks

Once Claude Code is running, try these prompts:

**List files on the remote system:**

> Show me what files are in /home/dev

**Create and edit files remotely:**

> Create a file called test.txt in /home/dev with some sample content, then read
> it back

**Run commands:**

> Run 'uname -a' to show the system information

**Search files:**

> Find all Python files under /home/dev/fixtures

All operations happen on the remote machine, not your local filesystem.

## How It Works

The `.mcp.json` file configures an MCP server that connects via SSH:

```json
{
  "mcpServers": {
    "remote-ssh": {
      "command": "remote-ssh-mcp",
      "args": ["--host", "localhost", "--port", "2222", ...]
    }
  }
}
```

This provides access to all remote tools (bash, read, write, edit, grep, glob)
through the MCP protocol.
