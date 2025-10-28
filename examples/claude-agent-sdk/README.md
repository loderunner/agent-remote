# Claude Agent SDK with Remote Tools

A complete example demonstrating how to use @agent-remote tools with the Claude
Agent SDK to create an AI agent that can interact with remote systems.

## What This Example Does

This example creates an autonomous AI agent that:

- Connects to a remote system
- Executes commands, reads files, and searches the filesystem remotely
- Uses the Claude Agent SDK to run multi-step tasks
- Provides all remote operations as MCP tools to Claude

The agent can analyze your task, decide which tools to use, execute them on the
remote system, and work autonomously until the task is complete.

## Prerequisites

- Node.js 20+
- An Anthropic API key (get one at
  [console.anthropic.com](https://console.anthropic.com))
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

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

### SSH Configuration

Configure SSH connection using environment variables:

| Variable       | Default     | Description                         |
| -------------- | ----------- | ----------------------------------- |
| `SSH_HOST`     | `localhost` | SSH server hostname                 |
| `SSH_PORT`     | `2222`      | SSH server port                     |
| `SSH_USERNAME` | `dev`       | SSH username                        |
| `SSH_PASSWORD` | `dev`       | SSH password (if not using key)     |
| `SSH_KEY_PATH` | -           | Path to private key file (optional) |

### Docker Configuration

Configure Docker connection using environment variables:

| Variable           | Default   | Description                  |
| ------------------ | --------- | ---------------------------- |
| `DOCKER_CONTAINER` | `sandbox` | Docker container name/ID     |
| `DOCKER_SHELL`     | `sh`      | Shell to use (sh, bash, zsh) |

## Running the Example

### Using SSH

```bash
# Uses default SSH settings (localhost:2222, user 'dev', password 'dev')
pnpm start:ssh

# Or with custom SSH settings
export SSH_HOST=myserver.com
export SSH_PORT=22
export SSH_USERNAME=myuser
export SSH_KEY_PATH=~/.ssh/id_rsa
pnpm start:ssh
```

### Using Docker

```bash
# Start a Docker container first
docker run -d --name my-container ubuntu:latest sleep infinity

# Run the example with Docker remote
export DOCKER_CONTAINER=my-container
export DOCKER_SHELL=bash
pnpm start:docker
```

## How It Works

The example accepts a command-line argument to choose the remote type:

- **SSH mode** (`pnpm start:ssh`): Establishes an SSH connection to a remote
  server and maintains it throughout the session
- **Docker mode** (`pnpm start:docker`): Executes commands directly in a Docker
  container using `docker exec`

Both modes expose the same set of tools to Claude:

- `bash` - Execute commands in a persistent shell session
- `bash-output` - Retrieve output from background shells
- `kill-bash` - Kill running background shells
- `read` - Read files with optional line ranges
- `write` - Write content to files
- `edit` - Edit files by replacing text
- `grep` - Search for patterns in files
- `glob` - Find files matching glob patterns

## Example Tasks

The example includes a sample task that demonstrates the agent's capabilities.
You can modify the `task` variable in `index.ts` to try different operations.

## Using with the Local Sandbox

This repository includes a sandbox environment for testing. To use it:

```bash
# Start the sandbox
cd ../../sandbox
docker compose up -d

# Run the example with SSH (default configuration works with the sandbox)
cd ../examples/claude-agent-sdk
pnpm start:ssh
```

Or use the Docker sandbox directly:

```bash
# The sandbox container is named 'sandbox'
cd ../../sandbox
docker compose up -d

cd ../examples/claude-agent-sdk
export DOCKER_CONTAINER=sandbox
pnpm start:docker
```
