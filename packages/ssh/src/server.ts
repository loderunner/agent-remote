import { readFileSync } from 'fs';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ConnectConfig } from 'ssh2';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import packageJson from '../package.json';

import { Remote } from './remote';

/**
 * Parse SSH configuration from command line arguments and environment variables.
 * Command line arguments take precedence over environment variables.
 */
function parseSSHConfig(): ConnectConfig {
  const argv = yargs(hideBin(process.argv))
    .usage('$0 [OPTIONS]')
    .version(packageJson.version)
    .help('help')
    .alias('help', 'h')
    .alias('version', 'V')
    .option('host', {
      alias: 'H',
      type: 'string',
      description: 'SSH host',
      default: process.env.SSH_HOST,
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'SSH port',
      default: process.env.SSH_PORT ? parseInt(process.env.SSH_PORT, 10) : 22,
    })
    .option('username', {
      alias: 'u',
      type: 'string',
      description: 'SSH username',
      default: process.env.SSH_USERNAME,
    })
    .option('password', {
      type: 'string',
      description: 'SSH password',
      default: process.env.SSH_PASSWORD,
    })
    .option('private-key', {
      type: 'string',
      description: 'Path to private key file',
      default: process.env.SSH_PRIVATE_KEY,
    })
    .option('passphrase', {
      type: 'string',
      description: 'Passphrase for encrypted private key',
      default: process.env.SSH_PASSPHRASE,
    })
    .option('agent', {
      type: 'string',
      description: 'SSH agent socket path',
      default: process.env.SSH_AUTH_SOCK,
    })
    .check(
      (argv: {
        host?: string;
        username?: string;
        password?: string;
        'private-key'?: string;
        agent?: string;
      }) => {
        if (!argv.host) {
          throw new Error('SSH host is required (--host or SSH_HOST)');
        }
        if (!argv.username) {
          throw new Error(
            'SSH username is required (--username or SSH_USERNAME)',
          );
        }
        if (!argv.password && !argv['private-key'] && !argv.agent) {
          throw new Error(
            'SSH authentication required: provide --password, --private-key, or --agent',
          );
        }
        return true;
      },
    )
    .group(
      [
        'host',
        'port',
        'username',
        'password',
        'private-key',
        'passphrase',
        'agent',
      ],
      'SSH Connection Options:',
    )
    .epilogue(
      'Environment Variables:\n' +
        '  SSH_HOST           SSH host\n' +
        '  SSH_PORT           SSH port\n' +
        '  SSH_USERNAME       SSH username\n' +
        '  SSH_PASSWORD       SSH password\n' +
        '  SSH_PRIVATE_KEY    Path to private key file or key content\n' +
        '  SSH_PASSPHRASE     Passphrase for private key\n' +
        '  SSH_AUTH_SOCK      SSH agent socket path\n\n' +
        'Authentication:\n' +
        '  Provide one of the following:\n' +
        '    - Password: --password or SSH_PASSWORD\n' +
        '    - Private key: --private-key or SSH_PRIVATE_KEY\n' +
        '    - SSH agent: --agent or SSH_AUTH_SOCK\n\n' +
        'Examples:\n' +
        '  # With password\n' +
        '  ssh-mcp-server --host example.com --username user --password secret\n\n' +
        '  # With private key\n' +
        '  ssh-mcp-server --host example.com --username user --private-key ~/.ssh/id_rsa\n\n' +
        '  # Using environment variables\n' +
        '  export SSH_HOST=example.com\n' +
        '  export SSH_USERNAME=user\n' +
        '  export SSH_PRIVATE_KEY=~/.ssh/id_rsa\n' +
        '  ssh-mcp-server',
    )
    .parseSync();

  const config: ConnectConfig = {
    host: argv.host as string,
    username: argv.username as string,
    port: argv.port,
  };

  // Determine authentication method
  if (argv.password) {
    config.password = argv.password;
  } else if (argv['private-key']) {
    const privateKeyPath = argv['private-key'];
    // Try to read as file first, fallback to using as key content
    try {
      config.privateKey = readFileSync(privateKeyPath, 'utf8');
    } catch {
      // If reading fails, assume it's the key content itself
      config.privateKey = privateKeyPath;
    }
    if (argv.passphrase) {
      config.passphrase = argv.passphrase;
    }
  } else if (argv.agent) {
    config.agent = argv.agent;
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
          result = await remote.bash.handler(args as never);
          break;
        case 'bash-output':
          result = await remote.bashOutput.handler(args as never);
          break;
        case 'kill-bash':
          result = await remote.killBash.handler(args as never);
          break;
        case 'grep':
          result = await remote.grep.handler(args as never);
          break;
        case 'read':
          result = await remote.read.handler(args as never);
          break;
        case 'write':
          result = await remote.write.handler(args as never);
          break;
        case 'edit':
          result = await remote.edit.handler(args as never);
          break;
        case 'glob':
          result = await remote.glob.handler(args as never);
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
