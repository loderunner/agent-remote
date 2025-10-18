import { readFileSync } from 'fs';

import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  TextBlock,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages.mjs';
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
      Please work on the REMOTE server (use the mcp__remote-ssh__ tools).
      The remote working directory is /home/dev.
      
      Do the following:
      1. List the contents of the current directory on the remote server
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
        for (const content of message.message.content) {
          if (content.type === 'text') {
            const textBlock = content as TextBlock;
            console.log(`Assistant: ${textBlock.text}`);
          } else if (content.type === 'tool_use') {
            const toolBlock = content as ToolUseBlock;
            console.log(`\nUsing tool: ${toolBlock.name}`);
            console.log(`Input: ${JSON.stringify(toolBlock.input, null, 2)}`);
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
