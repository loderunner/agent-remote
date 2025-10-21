# claude-remote

Remote execution tools for Claude AI agents. Connect Claude to remote systems
via SSH and give AI agents the ability to execute commands, manage files, and
search filesystems on remote machines.

## Packages

- **[@claude-remote/ssh](packages/ssh)** - TypeScript library providing
  SSH-based remote execution tools with MCP server support

## Examples

- **[claude-agent-sdk](examples/claude-agent-sdk)** - Using @claude-remote/ssh
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
