# Simple Agent Example

A simple example demonstrating how to use `@claude-remote/ssh` with the Claude
Agent SDK to create an AI agent that can interact with remote systems.

## What This Example Does

This example creates an AI agent that:

- Connects to a remote SSH server
- Has access to remote execution tools (bash, file operations, search)
- Executes a multi-step task autonomously
- Uses tool calling to interact with the remote system

## Prerequisites

1. **Running SSH Server**: You need access to an SSH server. The easiest way is
   to use the included sandbox:

   ```bash
   cd ../../sandbox
   docker-compose up -d
   cd -
   ```

2. **Anthropic API Key**: Set your API key as an environment variable:

   ```bash
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

3. **Dependencies**: Install dependencies from the monorepo root:
   ```bash
   cd ../..
   pnpm install
   pnpm build
   cd examples/simple-agent
   ```

## Configuration

The example uses environment variables for SSH configuration:

| Variable            | Default     | Description                         |
| ------------------- | ----------- | ----------------------------------- |
| `SSH_HOST`          | `localhost` | SSH server hostname                 |
| `SSH_PORT`          | `2222`      | SSH server port                     |
| `SSH_USERNAME`      | `dev`       | SSH username                        |
| `SSH_PASSWORD`      | `dev`       | SSH password (if not using key)     |
| `SSH_KEY_PATH`      | -           | Path to private key file (optional) |
| `ANTHROPIC_API_KEY` | -           | Your Anthropic API key (required)   |

## Running the Example

With the sandbox running and your API key set:

```bash
pnpm start
```

Or with custom SSH configuration:

```bash
export SSH_HOST=example.com
export SSH_PORT=22
export SSH_USERNAME=myuser
export SSH_PASSWORD=mypassword
pnpm start
```

## How It Works

The example demonstrates the full agent loop:

1. **Connect to Remote**: Establishes SSH connection and SFTP session
2. **Create MCP Server**: Wraps all remote tools in an MCP server
3. **Initialize Agent**: Creates Claude conversation with tool access
4. **Agent Loop**:
   - Claude analyzes the task and decides which tools to use
   - Tools are executed on the remote system
   - Results are sent back to Claude
   - Process repeats until task is complete
5. **Cleanup**: Disconnects from remote server

## Example Task

The default task asks the agent to:

1. List contents of the current directory
2. Find all TypeScript files in the fixtures directory
3. Count the .ts files
4. Show content of one TypeScript file

You can modify the `task` variable in `index.ts` to try different tasks.

## Available Tools

The agent has access to these tools on the remote system:

- **bash**: Execute shell commands
- **bash_output**: Get output from background commands
- **kill_bash**: Kill running background commands
- **grep**: Search for patterns in files
- **read**: Read file contents
- **write**: Write content to files
- **edit**: Edit files with find-replace
- **glob**: Find files matching patterns

## Customization

### Using Individual Tools

Instead of using all tools, you can select specific ones:

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const customServer = createSdkMcpServer({
  name: 'custom-remote',
  version: '1.0.0',
  tools: [
    tool(
      remote.bash.name,
      remote.bash.description,
      remote.bash.inputSchema,
      remote.bash.handler,
    ),
    tool(
      remote.read.name,
      remote.read.description,
      remote.read.inputSchema,
      remote.read.handler,
    ),
  ],
});
```

### Different Tasks

Try different tasks to see the agent in action:

```typescript
// Development task
const task = `
  Find all TODO comments in the codebase and create a summary.
`;

// System administration
const task = `
  Check disk usage, identify the largest directories, and list files 
  larger than 100MB.
`;

// Code analysis
const task = `
  Find all function definitions in TypeScript files and count how many 
  are exported vs internal.
`;
```

## Troubleshooting

### Connection Failed

If you can't connect to the SSH server:

- Verify the sandbox is running: `docker ps`
- Check SSH credentials are correct
- Try connecting manually: `ssh -p 2222 dev@localhost`

### API Key Error

If you get an authentication error:

- Verify your `ANTHROPIC_API_KEY` is set correctly
- Check the key has the necessary permissions

### Tool Errors

If tools fail to execute:

- Check the remote paths exist
- Verify file permissions on the remote system
- Review the error messages in the output

## Next Steps

- Modify the task to solve your own problems
- Add custom tools for specific needs
- Integrate with your own infrastructure
- Build more complex multi-step workflows
