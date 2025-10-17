/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { readFileSync } from 'fs';

import Anthropic from '@anthropic-ai/sdk';
import { Remote } from '@claude-remote/ssh';

/**
 * Simple example demonstrating how to use @claude-remote/ssh tools
 * with the Claude Agent SDK.
 *
 * This example connects to a remote SSH server and creates an AI agent
 * that can execute commands, read/write files, and search the filesystem.
 *
 * Note: Some TypeScript strict checks are disabled for simplicity in this example.
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
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Define tools for Claude API from remote tool definitions
    const tools: Anthropic.Tool[] = [
      {
        name: remote.bash.name,
        description: remote.bash.description,
        input_schema: {
          type: 'object' as const,
          ...remote.bash.inputSchema,
        },
      },
      {
        name: remote.read.name,
        description: remote.read.description,
        input_schema: {
          type: 'object' as const,
          ...remote.read.inputSchema,
        },
      },
      {
        name: remote.glob.name,
        description: remote.glob.description,
        input_schema: {
          type: 'object' as const,
          ...remote.glob.inputSchema,
        },
      },
      {
        name: remote.grep.name,
        description: remote.grep.description,
        input_schema: {
          type: 'object' as const,
          ...remote.grep.inputSchema,
        },
      },
    ];

    // Map of tool names to handlers
    const toolHandlers: Map<string, (input: any) => Promise<any>> = new Map();
    toolHandlers.set(remote.bash.name, remote.bash.handler);
    toolHandlers.set(remote.read.name, remote.read.handler);
    toolHandlers.set(remote.glob.name, remote.glob.handler);
    toolHandlers.set(remote.grep.name, remote.grep.handler);

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

    // Create agent conversation
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: task,
      },
    ];

    let response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      tools,
      messages,
    });

    // Agent loop: process tool calls and continue conversation
    while (response.stop_reason === 'tool_use') {
      console.log('Agent is using tools...\n');

      // Add assistant response to messages
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      // Execute tool calls
      const toolResultContent: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`Tool: ${block.name}`);
          console.log(`Input:`, JSON.stringify(block.input, null, 2));

          try {
            const handler = toolHandlers.get(block.name);
            if (!handler) {
              throw new Error(`Unknown tool: ${block.name}`);
            }

            const result = await handler(block.input);

            toolResultContent.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });

            console.log(`Result: ${JSON.stringify(result).slice(0, 200)}...\n`);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            toolResultContent.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `Error: ${errorMessage}`,
              is_error: true,
            });

            console.log(`Error: ${errorMessage}\n`);
          }
        }
      }

      messages.push({
        role: 'user',
        content: toolResultContent,
      });

      // Get next response
      response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        tools,
        messages,
      });
    }

    // Display final response
    console.log('--- Final Response ---\n');
    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(block.text);
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
