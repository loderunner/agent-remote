# Simple Agent Example

A simple example demonstrating how to use `@claude-remote/ssh` with
`@anthropic-ai/claude-agent-sdk` to create an AI agent that can interact with
remote systems.

## What This Example Does

This example creates an AI agent that:

- Connects to a remote SSH server
- Registers remote tools as an MCP server
- Uses the Claude Agent SDK to run autonomous tasks
- Executes commands, reads files, and searches the filesystem remotely

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

The example demonstrates the Agent SDK workflow:

1. **Connect to Remote**: Establishes SSH connection and SFTP session
2. **Create MCP Server**: Wraps all remote tools in an MCP server using
   `remote.createSdkMcpServer()`
3. **Create Query**: Initializes an agent query with the task and MCP server
   configuration
4. **Agent Loop**: The Agent SDK handles the full agentic loop:
   - Claude analyzes the task and decides which tools to use
   - Tools are executed on the remote system via the MCP server
   - Results are sent back to Claude
   - Process repeats until task is complete
5. **Stream Messages**: Process messages from the agent as they arrive
6. **Cleanup**: Disconnects from remote server

## Example Task

The default task asks the agent to:

1. List contents of the current directory
2. Find all TypeScript files in the fixtures directory
3. Count the .ts files
4. Show content of one TypeScript file

You can modify the `task` variable in `index.ts` to try different tasks.

## Available Tools

The MCP server provides access to these tools on the remote system:

- **bash**: Execute shell commands
- **bash-output**: Get output from background commands
- **kill-bash**: Kill running background commands
- **grep**: Search for patterns in files
- **read**: Read file contents
- **write**: Write content to files
- **edit**: Edit files with find-replace
- **glob**: Find files matching patterns

## Customization

### Permission Mode

The example uses `bypassPermissions` mode for simplicity. In production, you may
want to use `default` or `ask` mode:

```typescript
const agentQuery = query({
  prompt: task,
  options: {
    mcpServers: { 'remote-ssh': mcpServer },
    permissionMode: 'default', // or 'ask'
  },
});
```

### Working Directory

You can specify the working directory for the agent:

```typescript
const agentQuery = query({
  prompt: task,
  options: {
    mcpServers: { 'remote-ssh': mcpServer },
    cwd: '/path/to/working/directory',
  },
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
