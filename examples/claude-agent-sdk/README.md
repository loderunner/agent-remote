# Claude Agent SDK with @agent-remote/ssh

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A complete example demonstrating how to use `@agent-remote/ssh` with the Claude
Agent SDK to create an AI agent that can interact with remote systems via SSH.

## What This Example Does

This example creates an autonomous AI agent that:

- Connects to a remote SSH server
- Executes commands, reads files, and searches the filesystem remotely
- Uses the Claude Agent SDK to run multi-step tasks
- Provides all remote operations as MCP tools to Claude

The agent can analyze your task, decide which tools to use, execute them on the
remote system, and work autonomously until the task is complete.

## Prerequisites

- Node.js 20+
- An Anthropic API key (get one at
  [console.anthropic.com](https://console.anthropic.com))
- Access to an SSH server

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

Configure SSH connection using environment variables:

| Variable       | Default     | Description                         |
| -------------- | ----------- | ----------------------------------- |
| `SSH_HOST`     | `localhost` | SSH server hostname                 |
| `SSH_PORT`     | `2222`      | SSH server port                     |
| `SSH_USERNAME` | `dev`       | SSH username                        |
| `SSH_PASSWORD` | `dev`       | SSH password (if not using key)     |
| `SSH_KEY_PATH` | -           | Path to private key file (optional) |
