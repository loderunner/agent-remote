import { existsSync, readFileSync } from 'fs';
import { homedir, userInfo } from 'os';
import { join } from 'path';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ConnectConfig } from 'ssh2';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import packageJson from '../../package.json';

import { Remote } from '~/lib/remote';

/**
 * Finds the first available default SSH private key in the user's .ssh directory.
 * Mimics OpenSSH's default key search order.
 *
 * @returns The content of the first found key, or undefined if none found
 */
function findDefaultPrivateKey():
  | { privateKey: Buffer; source: string }
  | undefined {
  const sshDir = join(homedir(), '.ssh');
  const defaultKeys = ['id_ed25519', 'id_ecdsa', 'id_rsa', 'id_dsa'];

  for (const keyName of defaultKeys) {
    const keyPath = join(sshDir, keyName);
    if (existsSync(keyPath)) {
      try {
        const privateKey = readFileSync(keyPath);
        return { privateKey, source: keyPath };
      } catch {
        // If we can't read it, skip to next key
        continue;
      }
    }
  }

  return undefined;
}

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
    .env('SSH')
    .option('host', {
      alias: 'H',
      type: 'string',
      description: 'SSH host (env: SSH_HOST)',
      demandOption: true,
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'SSH port (env: SSH_PORT)',
      default: 22,
    })
    .option('username', {
      alias: 'u',
      type: 'string',
      description: 'SSH username (env: SSH_USERNAME)',
      default: userInfo().username,
    })
    .option('password', {
      type: 'string',
      description: 'SSH password (env: SSH_PASSWORD)',
    })
    .option('private-key', {
      type: 'string',
      description: 'Path to private key file (env: SSH_PRIVATE_KEY)',
    })
    .option('passphrase', {
      type: 'string',
      description: 'Passphrase for encrypted private key (env: SSH_PASSPHRASE)',
    })
    .option('agent', {
      type: 'string',
      description: 'SSH agent socket path (env: SSH_AUTH_SOCK)',
    })
    .option('default-keys', {
      type: 'boolean',
      description:
        'Automatically try default SSH keys from ~/.ssh (env: SSH_DEFAULT_KEYS)',
      default: true,
    })
    .option('timeout', {
      type: 'number',
      description: 'SSH connection timeout in milliseconds (env: SSH_TIMEOUT)',
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
        // if (!argv.username) {
        //   throw new Error(
        //     'SSH username is required (--username or SSH_USERNAME)',
        //   );
        // }
        const hasAuth =
          argv.password ??
          argv['private-key'] ??
          argv.agent ??
          process.env.SSH_AUTH_SOCK;
        if (!hasAuth) {
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
        'default-keys',
        'timeout',
      ],
      'SSH Connection Options:',
    )
    .epilogue(
      'Authentication:\n' +
        '  Provide one of the following:\n' +
        '    - Password: --password or SSH_PASSWORD\n' +
        '    - Private key: --private-key or SSH_PRIVATE_KEY\n' +
        '    - SSH agent: --agent or SSH_AUTH_SOCK\n\n',
    )
    .parseSync();

  const config: ConnectConfig = {
    host: argv.host,
    username: argv.username,
    port: argv.port,
  };

  // Add timeout if specified
  if (argv.timeout !== undefined) {
    config.readyTimeout = argv.timeout;
  }

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
  } else {
    // When no explicit auth is provided, mimic OpenSSH behavior:
    // 1. Try SSH agent (if available)
    // 2. Fall back to default private keys in ~/.ssh/ (if enabled)
    const agentPath = argv.agent ?? process.env.SSH_AUTH_SOCK;
    if (agentPath) {
      config.agent = agentPath;
    }

    // Also try to load default private key as fallback (if enabled)
    // ssh2 will try agent first, then fall back to privateKey
    if (argv['default-keys']) {
      const defaultKey = findDefaultPrivateKey();
      if (defaultKey) {
        config.privateKey = defaultKey.privateKey;
      }
    }
  }

  return config;
}

async function main() {
  // Parse SSH configuration
  const sshConfig = parseSSHConfig();

  // Debug: log connection details (but not sensitive auth info)
  const authMethods = [];
  if (sshConfig.agent) {
    const agentStr =
      typeof sshConfig.agent === 'string' ? sshConfig.agent : 'custom-agent';
    authMethods.push(`agent (${agentStr})`);
  }
  if (sshConfig.privateKey) {
    authMethods.push('privateKey');
  }
  if (sshConfig.password) {
    authMethods.push('password');
  }

  console.error('Connecting to SSH host:', {
    host: sshConfig.host,
    port: sshConfig.port,
    username: sshConfig.username,
    authMethods: authMethods.length > 0 ? authMethods.join(', ') : 'none',
  });

  // Connect to remote host
  const remote = await Remote.connect(sshConfig);
  console.error('Connected to remote host');

  // Check if SFTP is available
  if (!remote.hasSftp) {
    console.error(
      'Warning: SFTP not available - file operations will be disabled',
    );
  }

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
  console.error('MCP server connected to stdio');

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
  console.error(
    'Failed to start MCP server:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
