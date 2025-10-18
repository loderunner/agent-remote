import { readFileSync } from 'fs';
import { parseArgs } from 'util';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ConnectConfig } from 'ssh2';

import packageJson from '../package.json';

import { Remote } from './remote';

const HELP_TEXT = `
SSH MCP Server

Provides remote SSH tools through the Model Context Protocol over stdio transport.

USAGE:
  ssh-mcp-server [OPTIONS]

OPTIONS:
  --host, -h <host>           SSH host (required)
  --port, -p <port>           SSH port (default: 22)
  --username, -u <username>   SSH username (required)
  --password <password>       SSH password
  --private-key <path>        Path to private key file
  --passphrase <passphrase>   Passphrase for encrypted private key
  --agent <socket>            SSH agent socket path
  --help                      Show this help message

ENVIRONMENT VARIABLES:
  SSH_HOST           SSH host
  SSH_PORT           SSH port
  SSH_USERNAME       SSH username
  SSH_PASSWORD       SSH password
  SSH_PRIVATE_KEY    Path to private key file or key content
  SSH_PASSPHRASE     Passphrase for private key
  SSH_AUTH_SOCK      SSH agent socket path

AUTHENTICATION:
  Provide one of the following:
    - Password: --password or SSH_PASSWORD
    - Private key: --private-key or SSH_PRIVATE_KEY
    - SSH agent: --agent or SSH_AUTH_SOCK

EXAMPLES:
  # With password
  ssh-mcp-server --host example.com --username user --password secret

  # With private key
  ssh-mcp-server --host example.com --username user --private-key ~/.ssh/id_rsa

  # Using environment variables
  export SSH_HOST=example.com
  export SSH_USERNAME=user
  export SSH_PRIVATE_KEY=~/.ssh/id_rsa
  ssh-mcp-server
`;

/**
 * Parse SSH configuration from command line arguments and environment variables.
 * Command line arguments take precedence over environment variables.
 */
function parseSSHConfig(): ConnectConfig {
  // Check for help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.error(HELP_TEXT);
    process.exit(0);
  }
  const { values } = parseArgs({
    options: {
      host: { type: 'string' },
      port: { type: 'string' },
      username: { type: 'string' },
      password: { type: 'string' },
      'private-key': { type: 'string' },
      passphrase: { type: 'string' },
      agent: { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: false,
    allowPositionals: true,
  });

  const host = values.host ?? process.env.SSH_HOST;
  const portStr = values.port ?? process.env.SSH_PORT;
  const username = values.username ?? process.env.SSH_USERNAME;
  const password = values.password ?? process.env.SSH_PASSWORD;
  const privateKeyPath = values['private-key'] ?? process.env.SSH_PRIVATE_KEY;
  const passphrase = values.passphrase ?? process.env.SSH_PASSPHRASE;
  const agent = values.agent ?? process.env.SSH_AUTH_SOCK;

  if (!host) {
    throw new Error('SSH host is required (--host or SSH_HOST)');
  }

  if (!username) {
    throw new Error('SSH username is required (--username or SSH_USERNAME)');
  }

  const config: ConnectConfig = {
    host,
    username,
    port: portStr ? parseInt(portStr, 10) : 22,
  };

  // Determine authentication method
  if (password) {
    config.password = password;
  } else if (privateKeyPath) {
    // Try to read as file first, fallback to using as key content
    try {
      config.privateKey = readFileSync(privateKeyPath, 'utf8');
    } catch {
      // If reading fails, assume it's the key content itself
      config.privateKey = privateKeyPath;
    }
    if (passphrase) {
      config.passphrase = passphrase;
    }
  } else if (agent) {
    config.agent = agent;
  } else {
    throw new Error(
      'SSH authentication required: provide --password, --private-key, or --agent',
    );
  }

  return config;
}

async function main() {
  // Parse SSH configuration
  const sshConfig = parseSSHConfig();

  // Connect to remote host
  const remote = await Remote.connect(sshConfig);

  // Create MCP server
  const server = new Server(
    {
      name: 'ssh-remote',
      version: packageJson.version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: remote.bash.name,
          description: remote.bash.description,
          inputSchema: {
            type: 'object',
            properties: remote.bash.inputSchema,
          },
        },
        {
          name: remote.bashOutput.name,
          description: remote.bashOutput.description,
          inputSchema: {
            type: 'object',
            properties: remote.bashOutput.inputSchema,
          },
        },
        {
          name: remote.killBash.name,
          description: remote.killBash.description,
          inputSchema: {
            type: 'object',
            properties: remote.killBash.inputSchema,
          },
        },
        {
          name: remote.grep.name,
          description: remote.grep.description,
          inputSchema: {
            type: 'object',
            properties: remote.grep.inputSchema,
          },
        },
        {
          name: remote.read.name,
          description: remote.read.description,
          inputSchema: {
            type: 'object',
            properties: remote.read.inputSchema,
          },
        },
        {
          name: remote.write.name,
          description: remote.write.description,
          inputSchema: {
            type: 'object',
            properties: remote.write.inputSchema,
          },
        },
        {
          name: remote.edit.name,
          description: remote.edit.description,
          inputSchema: {
            type: 'object',
            properties: remote.edit.inputSchema,
          },
        },
        {
          name: remote.glob.name,
          description: remote.glob.description,
          inputSchema: {
            type: 'object',
            properties: remote.glob.inputSchema,
          },
        },
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case 'bash':
          result = await remote.bash.handler(args);
          break;
        case 'bash-output':
          result = await remote.bashOutput.handler(args);
          break;
        case 'kill-bash':
          result = await remote.killBash.handler(args);
          break;
        case 'grep':
          result = await remote.grep.handler(args);
          break;
        case 'read':
          result = await remote.read.handler(args);
          break;
        case 'write':
          result = await remote.write.handler(args);
          break;
        case 'edit':
          result = await remote.edit.handler(args);
          break;
        case 'glob':
          result = await remote.glob.handler(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    void remote.disconnect().then(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    void remote.disconnect().then(() => {
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
