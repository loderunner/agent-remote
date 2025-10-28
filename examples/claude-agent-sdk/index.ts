import { readFileSync } from 'fs';

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { TextBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources';
import { Remote as SSHRemote } from '@agent-remote/ssh';
import { Remote as DockerRemote } from '@agent-remote/docker';

/**
 * Simple example demonstrating how to use @agent-remote tools with the Claude
 * Agent SDK.
 *
 * This example connects to a remote system and creates an AI agent
 * that can execute commands, read/write files, and search the filesystem.
 */

type RemoteType = 'ssh' | 'docker';

type SshConfig = {
  type: 'ssh';
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
};

type DockerConfig = {
  type: 'docker';
  container: string;
  shell?: string;
};

type RemoteConfig = SshConfig | DockerConfig;

function getRemoteConfig(): RemoteConfig {
  const args = process.argv.slice(2);
  const remoteType = (args[0] ?? 'ssh') as RemoteType;

  if (!['ssh', 'docker'].includes(remoteType)) {
    console.error(`Invalid remote type: ${remoteType}`);
    console.error('Usage: tsx index.ts [ssh|docker]');
    process.exit(1);
  }

  if (remoteType === 'docker') {
    const container = process.env.DOCKER_CONTAINER ?? 'sandbox';
    const shell = process.env.DOCKER_SHELL;

    return {
      type: 'docker',
      container,
      shell,
    };
  }

  const host = process.env.SSH_HOST ?? 'localhost';
  const port = process.env.SSH_PORT ? parseInt(process.env.SSH_PORT) : 2222;
  const username = process.env.SSH_USERNAME ?? 'dev';
  const password = process.env.SSH_PASSWORD ?? 'dev';
  const privateKeyPath = process.env.SSH_KEY_PATH;

  return {
    type: 'ssh',
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
  const config = getRemoteConfig();

  let remote: SSHRemote | DockerRemote;
  let mcpServerName: string;
  let needsDisconnect = false;

  if (config.type === 'docker') {
    console.log(`Using Docker container: ${config.container}...`);
    remote = new DockerRemote({
      container: config.container,
      shell: config.shell,
    });
    mcpServerName = 'remote-docker';
    console.log('Remote ready!\n');
  } else {
    console.log(
      `Connecting to ${config.username}@${config.host}:${config.port}...`,
    );
    remote = await SSHRemote.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKeyPath
        ? readFileSync(config.privateKeyPath)
        : undefined,
    });
    mcpServerName = 'remote-ssh';
    needsDisconnect = true;
    console.log('Connected successfully!\n');
  }

  try {
    const mcpServer = remote.createSdkMcpServer(mcpServerName);

    const task = `
      Please work on the REMOTE server (use the mcp__${mcpServerName}__ tools).
      The remote working directory is /home/dev.
      
      Do the following:
      1. List the contents of the current directory on the remote server
      2. Find all TypeScript files (*.ts) in the fixtures directory
      3. Count how many .ts files exist
      4. Show me the content of one of the TypeScript files
    `;

    console.log('Task:', task);
    console.log('\n--- Agent Response ---\n');

    const agentQuery = query({
      prompt: task,
      options: {
        mcpServers: {
          [mcpServerName]: mcpServer,
        },
        permissionMode: 'bypassPermissions',
      },
    });

    for await (const message of agentQuery) {
      if (message.type === 'system' && message.subtype === 'init') {
        console.log(`Model: ${message.model}`);
        console.log(`Available tools: ${message.tools.join(', ')}`);
        console.log('');
      } else if (message.type === 'assistant') {
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
    if (needsDisconnect) {
      await (remote as SSHRemote).disconnect();
      console.log('\nDisconnected from remote server.');
    }
  }
}

// Run the example
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
