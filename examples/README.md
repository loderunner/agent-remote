# Examples

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../LICENSE)

This directory contains example projects demonstrating how to use
`@agent-remote/ssh` with the Claude Agent SDK.

## Available Examples

### [claude-agent-sdk](./claude-agent-sdk)

A basic example showing how to:

- Connect to a remote SSH server
- Create an AI agent with remote execution tools
- Execute multi-step tasks autonomously
- Use the Claude Agent SDK with MCP tools

Perfect for getting started and understanding the fundamentals.

## Development Setup (Contributors)

This guide is for developers working on the monorepo who want to test changes to
`@agent-remote/ssh` in the examples.

### Prerequisites

1. **Start the sandbox** (from monorepo root):

   ```bash
   cd sandbox
   docker-compose up -d
   cd ..
   ```

   This provides a Docker container with SSH access for testing.

2. **Build the SSH package** (from monorepo root):

   ```bash
   cd packages/ssh
   pnpm build
   cd ../..
   ```

### Linking the Local Package

To use your local development version of `@agent-remote/ssh`:

```bash
cd examples/claude-agent-sdk
pnpm link ../../packages/ssh
pnpm install
```

The `pnpm link` command:

- Creates a symlink from `node_modules/@agent-remote/ssh` to
  `../../packages/ssh`
- Adds an override to `examples/pnpm-workspace.yaml` that persists across
  installs

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
pnpm start
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
pnpm start
```

### Unlinking (Reverting to npm Version)

To stop using the local package and use the published npm version:

1. Remove the `overrides:` section from `examples/pnpm-workspace.yaml`
2. Reinstall:

   ```bash
   cd examples/claude-agent-sdk
   rm pnpm-lock.yaml
   pnpm install
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
