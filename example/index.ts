import {
  createSdkMcpServer,
  query,
  tool,
} from '@anthropic-ai/claude-agent-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';

import type { RemoteTool } from '@claude-remote/ssh';
import { connect } from '@claude-remote/ssh';

/**
 * Creates an MCP server with SSH tools adapted for the Agent SDK.
 * Wraps each tool handler to accept the extra parameter the SDK expects.
 */
function createSSHMcpServer(
  sshTools: Awaited<ReturnType<typeof connect>>['tools'],
) {
  const adaptedTools = Object.values(sshTools).map((t) =>
    tool(
      t.name,
      t.description,
      t.inputSchema,
      async (args: unknown, _extra: unknown): Promise<CallToolResult> => {
        return await (t as RemoteTool).handler(args);
      },
    ),
  );

  return createSdkMcpServer({
    name: 'ssh-remote',
    version: '1.0.0',
    tools: adaptedTools,
  });
}

async function main() {
  // Ensure ANTHROPIC_API_KEY is set
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  // Connect to SSH server
  const { tools, disconnect } = await connect({
    host: 'localhost',
    port: 2222,
    username: 'dev',
    password: 'dev',
  });

  // Create the MCP server with SSH tools
  const mcpServer = createSSHMcpServer(tools);

  try {
    // Run a query that leverages the SSH tools
    const queryInstance = query({
      prompt: `
        I need you to explore the file system and tell me:
        1. What files are in sandbox/fixtures/
        2. Read the contents of sandbox/fixtures/simple.txt
        3. Create a new file sandbox/fixtures/hello.txt with the content "Hello from Claude!"
        4. Search for any .md files in sandbox/fixtures/
      `,
      options: {
        mcpServers: {
          'ssh-remote': mcpServer,
        },
        allowedTools: Object.values(tools).map(
          (t) => `mcp__ssh-remote__${t.name}`,
        ),
        disallowedTools: [
          'Grep',
          'Read',
          'Write',
          'Edit',
          'Glob',
          'Bash',
          'BashOutput',
          'KillBash',
        ],
      },
    });

    // Stream the response
    for await (const message of queryInstance) {
      if (message.type === 'assistant') {
        // Assistant messages contain the raw API response
        const content = message.message.content;
        for (const block of content) {
          if (block.type === 'text') {
            console.log('\n[Assistant]:', block.text);
          } else if (block.type === 'tool_use') {
            console.log(
              `\n[Tool Use]: ${block.name}`,
              JSON.stringify(block.input, null, 2),
            );
          }
        }
      } else if (message.type === 'user') {
        console.log('\n[User Message]');
      } else if (message.type === 'result') {
        // Final result of the query
        if (message.subtype === 'success') {
          console.log('\n[Query Complete]');
          console.log('Result:', message.result);
          console.log('Turns:', message.num_turns);
          console.log('Cost:', `$${message.total_cost_usd.toFixed(4)}`);
        } else {
          console.log('\n[Query Error]:', message.subtype);
        }
      } else if (message.type === 'stream_event') {
        // Handle streaming events for real-time output
        if (message.event.type === 'content_block_delta') {
          if (message.event.delta.type === 'text_delta') {
            process.stdout.write(message.event.delta.text);
          }
        }
      } else if (message.type === 'system') {
        if (message.subtype === 'init') {
          console.log('[System Initialized]');
          console.log('- Model:', message.model);
          console.log('- Tools:', message.tools.join(', '));
          console.log(
            '- MCP Servers:',
            message.mcp_servers.map((s) => s.name).join(', '),
          );
        }
      }
    }
  } finally {
    // Clean up
    disconnect();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
