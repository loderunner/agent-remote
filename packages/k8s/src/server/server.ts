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

import { Remote } from '../lib/remote.js';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      destination: 2,
    },
  },
});

/**
 * Parse Kubernetes configuration from command line arguments and environment variables.
 * Command line arguments take precedence over environment variables.
 */
function parseK8sConfig(): {
  pod: string;
  namespace?: string;
  container?: string;
  shell?: string;
} {
  const argv = yargs(hideBin(process.argv))
    .usage('remote-k8s-mcp [OPTIONS]')
    .version(packageJson.version)
    .help('help')
    .alias('help', 'h')
    .alias('version', 'V')
    .option('debug', {
      type: 'boolean',
      description: 'Enable debug output',
      default: false,
    })
    .env('K8S')
    .option('pod', {
      alias: 'p',
      type: 'string',
      description: 'Kubernetes pod name (env: K8S_POD)',
      demandOption: true,
    })
    .option('namespace', {
      alias: 'n',
      type: 'string',
      description: 'Kubernetes namespace (env: K8S_NAMESPACE, default: default)',
      default: 'default',
    })
    .option('container', {
      alias: 'c',
      type: 'string',
      description:
        'Container name within the pod (env: K8S_CONTAINER, optional)',
    })
    .option('shell', {
      alias: 's',
      type: 'string',
      description:
        'Shell to use for command execution (env: K8S_SHELL, default: sh)',
      default: 'sh',
    })
    .group(['pod', 'namespace', 'container', 'shell'], 'Kubernetes Connection Options:')
    .epilogue(
      'Usage:\n' +
        '  Specify the pod name to execute commands on.\n' +
        '  Optionally specify a namespace (defaults to default).\n' +
        '  Optionally specify a container name within the pod.\n' +
        '  Optionally specify a shell to use (sh, bash, zsh, etc.).\n' +
        '    Shell executable must be available in the pod.\n\n',
    )
    .parseSync();

  if (argv.debug) {
    logger.level = 'debug';
  }

  return {
    pod: argv.pod,
    namespace: argv.namespace,
    container: argv.container,
    shell: argv.shell,
  };
}

async function main() {
  // Parse Kubernetes configuration
  const config = parseK8sConfig();

  logger.info(
    {
      pod: config.pod,
      namespace: config.namespace,
      container: config.container,
      shell: config.shell,
    },
    'Connecting to Kubernetes pod:',
  );

  // Create remote instance
  const remote = new Remote(config);
  logger.info('Connected to Kubernetes pod');

  // Create MCP server
  const server = new Server(
    {
      name: 'k8s-remote',
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
