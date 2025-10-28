# Examples

This directory contains example projects demonstrating how to use
`@agent-remote` tools with various AI frameworks.

## Available Examples

### [claude-agent-sdk](./claude-agent-sdk)

A complete example showing how to:

- Connect to a remote system
- Create an AI agent with remote execution tools
- Execute multi-step tasks autonomously
- Use the Claude Agent SDK with MCP tools

### [claude-code-ssh](./claude-code-ssh)

Configuration examples for using Claude Code with remote systems:

- MCP server configuration for SSH remotes
- MCP server configuration for Docker remotes
- Example configurations for both simultaneously
- Works with the included sandbox environment

Perfect for using Claude Code to work on remote systems.

## Development Setup (Contributors)

This guide is for developers working on the monorepo who want to test changes to
`@agent-remote/ssh` or `@agent-remote/docker` in the examples.

### Prerequisites

1. **Start the sandbox** (from monorepo root):

```bash
cd sandbox
docker compose up -d
cd ..
```

This provides a Docker container accessible via SSH or Docker exec for testing.

2. **Build the packages** (from monorepo root):

   ```bash
   # Build SSH package
   cd packages/ssh
   pnpm build
   cd ../..

   # Build Docker package
   cd packages/docker
   pnpm build
   cd ../..
   ```

### Development Workflow

**Option 1: Watch mode (recommended)**

Start the build watcher to automatically rebuild on changes:

```bash
# From monorepo root
pnpm build:watch
```

In another terminal, run the example:

```bash
cd examples/claude-agent-sdk
export ANTHROPIC_API_KEY=your_api_key_here
pnpm start:ssh  # or pnpm start:docker
```

Now edit files in `packages/ssh/src/` - they'll automatically rebuild, and the
example will use the updated code!

**Option 2: Manual rebuild**

```bash
# Make changes to packages/ssh/src/*
cd packages/ssh
pnpm build

# Run the example
cd ../examples/claude-agent-sdk
pnpm start:ssh  # or pnpm start:docker
```

## Adding New Examples

When adding a new example:

1. Create a new directory under `examples/`
2. Add it to `examples/pnpm-workspace.yaml`
3. Create a standalone README
4. Add a summary here in the main examples README
5. Ensure it works both with linked and published packages

## Contributing Examples

Have a cool example to share? Add it here! Examples should:

- Be well-documented with a README
- Include clear setup instructions
- Demonstrate a specific use case or pattern
- Work with the included sandbox for easy testing
- Be written as standalone projects (minimal monorepo references)
