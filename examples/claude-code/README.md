# Claude Code with Remote Tools

Configuration examples for using Claude Code with remote systems via SSH or
Docker. All file operations and command executions happen on the remote machine
instead of your local filesystem.

## What This Example Does

This example shows how to configure Claude Code to:

- Connect to a remote system (SSH server or Docker container) via the MCP
  protocol
- Execute all bash commands on the remote system
- Read, write, and edit files remotely
- Search files with grep and glob patterns on the remote filesystem
- Disable local file/command tools to prevent accidental local operations

## Prerequisites

- Node.js 20+
- Claude Code CLI
- Either:
  - Access to an SSH server, or
  - Docker with a running container

## Installation

```bash
pnpm install
# or
npm install
```

## Configuration

Choose one of the configuration options below based on your remote type.

### Option 1: SSH Remote

Create a `.mcp.json` file in this directory:

```json
{
  "mcpServers": {
    "remote-ssh": {
      "command": "remote-ssh-mcp",
      "args": [
        "--host",
        "localhost",
        "--port",
        "2222",
        "--username",
        "dev",
        "--password",
        "dev"
      ]
    }
  }
}
```

**SSH Arguments:**

| Argument        | Description              | Required |
| --------------- | ------------------------ | -------- |
| `--host`        | SSH server hostname      | Yes      |
| `--port`        | SSH server port          | No       |
| `--username`    | SSH username             | Yes      |
| `--password`    | Password authentication  | No\*     |
| `--private-key` | Path to private key file | No\*     |
| `--agent`       | Use SSH agent            | No\*     |

\* At least one authentication method is required

**Example with SSH key:**

```json
{
  "mcpServers": {
    "remote-ssh": {
      "command": "remote-ssh-mcp",
      "args": [
        "--host",
        "myserver.com",
        "--username",
        "myuser",
        "--private-key",
        "/path/to/id_rsa"
      ]
    }
  }
}
```

### Option 2: Docker Remote

Create a `.mcp.json` file in this directory:

```json
{
  "mcpServers": {
    "remote-docker": {
      "command": "remote-docker-mcp",
      "args": ["--container", "my-container", "--shell", "bash"]
    }
  }
}
```

**Docker Arguments:**

| Argument      | Description                | Required | Default |
| ------------- | -------------------------- | -------- | ------- |
| `--container` | Container name or ID       | Yes      | -       |
| `--shell`     | Shell to use (sh/bash/zsh) | No       | `sh`    |

## Running the Example

After creating your `.mcp.json` file:

```bash
pnpm start
# or
npm start
```

Claude Code will start with the configured remote server connected. All file and
command operations will execute on the remote system.

## Example Tasks

Once Claude Code is running, try these prompts:

### With SSH Remote

> Show me what files are in /home/dev

> Create a file called test.txt in /home/dev with some sample content, then read
> it back

> Run 'uname -a' to show the system information

> Find all Python files under /home/dev/fixtures

### With Docker Remote

> List the contents of /app

> Check which shell we're using by running 'echo $SHELL'

> Create a simple Node.js app in /tmp/myapp with a package.json file

> Search for TODO comments in /app

All operations happen on the remote machine, not your local filesystem.

## Using with the Local Sandbox

This repository includes a sandbox environment for testing:

### SSH Sandbox

```bash
# Start the SSH sandbox
cd ../../sandbox
docker compose up -d

# Create .mcp.json with sandbox SSH settings
cd ../examples/claude-code-ssh
cp .mcp.json.ssh-example .mcp.json

pnpm start
```

### Docker Sandbox

```bash
cp .mcp.json.docker-example .mcp.json

pnpm start
```

## Available Tools

Both SSH and Docker remotes provide these tools:

- `bash` - Execute commands in a persistent shell session
- `bash-output` - Retrieve output from background shells
- `kill-bash` - Kill running background shells
- `read` - Read files with optional line ranges
- `write` - Write content to files
- `edit` - Edit files by replacing text
- `grep` - Search for patterns in files
- `glob` - Find files matching glob patterns

## Notes

- The `.mcp.json` file is gitignored to prevent accidentally committing
  credentials
- Make sure the MCP server binaries (`remote-ssh-mcp` and `remote-docker-mcp`)
  are built and in your PATH, or use absolute paths in the `command` field
- For Docker remote, ensure the container is running before starting Claude Code
- For SSH remote, ensure you have network access to the SSH server
