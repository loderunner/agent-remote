# agent-remote

[![CircleCI](https://dl.circleci.com/status-badge/img/circleci/27HiJjfeSar9ELMpivBc9u/VyteHXLsZWYgWKcZqQgFP3/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/circleci/27HiJjfeSar9ELMpivBc9u/VyteHXLsZWYgWKcZqQgFP3/tree/main)
[![GitHub Actions](https://github.com/loderunner/agent-remote/workflows/Release%20Please/badge.svg)](https://github.com/loderunner/agent-remote/actions)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Remote execution tools for AI agents. Connect AI agents to remote systems via
SSH to execute commands, manage files, and search filesystems on remote
machines.

## Packages

- **[@agent-remote/core](packages/core)** - Core types and schemas for remote
  tool definitions
- **[@agent-remote/ssh](packages/ssh)** - TypeScript library providing SSH-based
  remote execution tools with MCP server support
- **[integration-tests](packages/integration-tests)** - Generic integration
  tests for remote implementations

## Examples

- **[claude-agent-sdk](examples/claude-agent-sdk)** - Using @agent-remote/ssh
  with Claude Agent SDK to create autonomous AI agents
- **[claude-code-ssh](examples/claude-code-ssh)** - Configuration for using
  Claude Code with remote SSH tools

## Development

The project includes a Docker-based sandbox environment for testing. See
[sandbox/README.md](sandbox/README.md) for details.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm lint:fix
```

## License

Apache-2.0

Copyright (c) 2025 Charles Francoise
