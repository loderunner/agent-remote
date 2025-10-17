import { readFileSync } from 'fs';

import { query } from '@anthropic-ai/claude-agent-sdk';
import { Remote } from '@claude-remote/ssh';

/**
 * Simple example demonstrating how to use @claude-remote/ssh tools
 * with the Claude Agent SDK.
 *
 * This example connects to a remote SSH server and creates an AI agent
 * that can execute commands, read/write files, and search the filesystem.
 */

type RemoteConfig = {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
};

/**
 * Loads SSH configuration from environment variables
 */
function getRemoteConfig(): RemoteConfig {
  const host = process.env.SSH_HOST ?? 'localhost';
  const port = process.env.SSH_PORT ? parseInt(process.env.SSH_PORT) : 2222;
  const username = process.env.SSH_USERNAME ?? 'dev';
  const password = process.env.SSH_PASSWORD ?? 'dev';
  const privateKeyPath = process.env.SSH_KEY_PATH;

  return {
    host,
    port,
    username,
    password,
    privateKeyPath,
  };
}

/**
 * Main function that demonstrates using remote tools with Claude
 */
async function main() {
  // Load configuration
  const config = getRemoteConfig();

  console.log(
    `Connecting to ${config.username}@${config.host}:${config.port}...`,
  );

  // Connect to remote server
  const remote = await Remote.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    privateKey: config.privateKeyPath
      ? readFileSync(config.privateKeyPath)
      : undefined,
  });

  console.log('Connected successfully!\n');

  try {
    // Create MCP server with all remote tools
    const mcpServer = remote.createSdkMcpServer();

    // Example task: List files and count TypeScript files
    const task = `
      Please do the following:
      1. List the contents of the current directory
      2. Find all TypeScript files (*.ts) in the fixtures directory
      3. Count how many .ts files exist
      4. Show me the content of one of the TypeScript files
    `;

    console.log('Task:', task);
    console.log('\n--- Agent Response ---\n');

    // Create agent query with remote tools
    const agentQuery = query({
      prompt: task,
      options: {
        mcpServers: {
          'remote-ssh': mcpServer,
        },
        model: 'claude-3-5-sonnet-20241022',
        cwd: '/home/dev',
        permissionMode: 'bypassPermissions',
      },
    });

    // Process agent messages
    for await (const message of agentQuery) {
      if (message.type === 'system' && message.subtype === 'init') {
        console.log(`Model: ${message.model}`);
        console.log(`Available tools: ${message.tools.join(', ')}`);
        console.log('');
      } else if (message.type === 'assistant') {
        // Display assistant message content
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (const content of message.message.content) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (content.type === 'text') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.log(`Assistant: ${content.text}`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (content.type === 'tool_use') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.log(`\nUsing tool: ${content.name}`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.log(`Input: ${JSON.stringify(content.input, null, 2)}`);
          }
        }
        console.log('');
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n--- Final Result ---\n');
          console.log(message.result);
          console.log(`\nTurns: ${message.num_turns}`);
          console.log(`Duration: ${message.duration_ms}ms`);
          console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        } else {
          console.error(`\nError: ${message.subtype}`);
        }
      }
    }
  } finally {
    // Clean up connection
    await remote.disconnect();
    console.log('\nDisconnected from remote server.');
  }
}

// Run the example
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
