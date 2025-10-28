import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { zodToJsonSchema } from 'zod-to-json-schema';

import packageJson from '../../package.json';

import { Remote } from '~/lib/remote';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      destination: 2,
    },
  },
});

/**
 * Parse Docker configuration from command line arguments and environment variables.
 * Command line arguments take precedence over environment variables.
 */
function parseDockerConfig(): { container: string; shell?: string } {
  const argv = yargs(hideBin(process.argv))
    .usage('remote-docker-mcp [OPTIONS]')
    .version(packageJson.version)
    .help('help')
    .alias('help', 'h')
    .alias('version', 'V')
    .option('debug', {
      type: 'boolean',
      description: 'Enable debug output',
      default: false,
    })
    .env('DOCKER')
    .option('container', {
      alias: 'c',
      type: 'string',
      description: 'Docker container name (env: DOCKER_CONTAINER)',
      demandOption: true,
    })
    .option('shell', {
      alias: 's',
      type: 'string',
      description:
        'Shell to use for command execution (env: DOCKER_SHELL, default: sh)',
      default: 'sh',
    })
    .group(['container', 'shell'], 'Docker Connection Options:')
    .epilogue(
      'Usage:\n' +
        '  Specify the container name to execute commands on.\n' +
        '  Optionally specify a shell to use (sh, bash, zsh, etc.).\n\n' +
        'Examples:\n' +
        '  remote-docker-mcp --container my-app\n' +
        '  remote-docker-mcp --container my-app --shell bash\n' +
        '  DOCKER_CONTAINER=my-app remote-docker-mcp\n',
    )
    .parseSync();

  if (argv.debug) {
    logger.level = 'debug';
  }

  return {
    container: argv.container,
    shell: argv.shell,
  };
}

async function main() {
  // Parse Docker configuration
  const config = parseDockerConfig();

  logger.info(
    {
      container: config.container,
      shell: config.shell,
    },
    'Connecting to Docker container:',
  );

  // Create remote instance
  const remote = new Remote(config);
  logger.info('Connected to Docker container');

  // Create MCP server
  const server = new Server(
    {
      name: 'docker-remote',
      version: packageJson.version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async (req) => {
    logger.debug({ params: req.params }, 'Received list tools request');
    return {
      tools: [
        {
          name: remote.bash.name,
          description: remote.bash.description,
          inputSchema: zodToJsonSchema(remote.bash.inputSchema),
        },
        {
          name: remote.bashOutput.name,
          description: remote.bashOutput.description,
          inputSchema: zodToJsonSchema(remote.bashOutput.inputSchema),
        },
        {
          name: remote.killBash.name,
          description: remote.killBash.description,
          inputSchema: zodToJsonSchema(remote.killBash.inputSchema),
        },
        {
          name: remote.grep.name,
          description: remote.grep.description,
          inputSchema: zodToJsonSchema(remote.grep.inputSchema),
        },
        {
          name: remote.read.name,
          description: remote.read.description,
          inputSchema: zodToJsonSchema(remote.read.inputSchema),
        },
        {
          name: remote.write.name,
          description: remote.write.description,
          inputSchema: zodToJsonSchema(remote.write.inputSchema),
        },
        {
          name: remote.edit.name,
          description: remote.edit.description,
          inputSchema: zodToJsonSchema(remote.edit.inputSchema),
        },
        {
          name: remote.glob.name,
          description: remote.glob.description,
          inputSchema: zodToJsonSchema(remote.glob.inputSchema),
        },
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.debug({ params: request.params }, 'Received tool call request');
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

      logger.debug({ result }, 'Tool call result');
      return result;
    } catch (error) {
      logger.error({ error }, 'Error in tool call');
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
  logger.info('MCP server connected to stdio');

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down');
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(error, 'Failed to start MCP server');
  process.exit(1);
});


