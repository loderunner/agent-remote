# Examples

This directory contains example projects demonstrating how to use
`@claude-remote/ssh` with the Claude Agent SDK.

## Available Examples

### [claude-agent-sdk](./claude-agent-sdk)

A basic example showing how to:

- Connect to a remote SSH server
- Create an AI agent with remote execution tools
- Execute multi-step tasks autonomously
- Use the Claude Agent SDK with MCP tools

Perfect for getting started and understanding the fundamentals.

## Running Examples

Each example is standalone with its own dependencies. See the individual README
files for detailed instructions.

**Quick start**:

1. **Start the sandbox** (optional, from monorepo root):

   ```bash
   cd sandbox
   docker-compose up -d
   cd ..
   ```

2. **Build the SSH package** (from monorepo root):

   ```bash
   cd packages/ssh
   pnpm build
   cd ../..
   ```

3. **Navigate to an example**:

   ```bash
   cd examples/claude-agent-sdk
   ```

4. **Install dependencies**:

   ```bash
   pnpm install
   ```

5. **Link the local SSH package**:

   ```bash
   pnpm link ../../packages/ssh
   ```

   This creates a symlink to your local `@claude-remote/ssh` package, allowing
   you to test changes without publishing. The package must be built first (step
   2).

   Note: This command adds an override to `examples/pnpm-workspace.yaml` to
   persist the link across installs.

6. **Set your API key**:

   ```bash
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

7. **Run the example**:
   ```bash
   pnpm start
   ```

### Development Workflow

When working on the SSH package and testing changes in an example:

**Option 1: Watch mode (recommended)**

1. Start the build watcher (from monorepo root):

   ```bash
   pnpm build:watch
   ```

   This automatically rebuilds the SSH package whenever you save changes.

2. In another terminal, run the example:

   ```bash
   cd examples/claude-agent-sdk
   pnpm start
   ```

3. Make changes to the SSH package code - they'll be automatically rebuilt!

**Option 2: Manual rebuild**

1. Make changes to the SSH package code
2. Rebuild the package: `cd packages/ssh && pnpm build`
3. The example will automatically use the updated code (already linked)
4. Run the example: `cd examples/claude-agent-sdk && pnpm start`

To unlink and use the published npm version instead:

1. Remove the override from `examples/pnpm-workspace.yaml` (delete the
   `overrides:` section)
2. Reinstall dependencies:

```bash
cd examples/claude-agent-sdk
rm pnpm-lock.yaml
pnpm install
```

## Contributing Examples

Have a cool example to share? Add it here! Examples should:

- Be well-documented with a README
- Include clear setup instructions
- Demonstrate a specific use case or pattern
- Work with the included sandbox for easy testing
