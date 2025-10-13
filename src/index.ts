import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp';
import { Client, ConnectConfig } from 'ssh2';
import { ZodRawShape } from 'zod';

import {
  BashInput,
  BashOutputInput,
  BashTool,
  KillShellInput,
  bashInputSchema,
  bashOutputInputSchema,
  killShellInputSchema,
} from './bash';

type ToolDefinition<InputArgs extends ZodRawShape> = {
  name: string;
  description: string;
  inputSchema: InputArgs;
  handler: ToolCallback<InputArgs>;
};

function tool<InputArgs extends ZodRawShape>(
  definition: ToolDefinition<InputArgs>,
): ToolDefinition<InputArgs> {
  return definition;
}

/**
 * Connects to a remote SSH server and returns tool for remote execution
 */
export async function connect(sshConfig: ConnectConfig) {
  const client = new Client();
  await new Promise((resolve, reject) => {
    client.on('ready', () => {
      resolve(client);
    });
    client.on('error', (err) => {
      reject(err);
    });
    client.connect(sshConfig);
  });

  const bashTool = new BashTool(client);

  return {
    disconnect: () => {
      client.end();
      client.destroy();
    },
    tools: [
      tool({
        name: 'bash',
        description:
          'Executes a bash command in a persistent shell session with optional timeout. For terminal operations like git, npm, docker, etc. DO NOT use for file operations - use specialized tools instead.',
        inputSchema: bashInputSchema.shape,
        handler: async (input: BashInput) => {
          try {
            const output = await bashTool.execute(input);
            return {
              content: [
                {
                  type: 'text',
                  text: output.output,
                },
              ],
              structuredContent: output,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to execute bash command: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      }),
      tool({
        name: 'bash-output',
        description:
          'Retrieves output from a running or completed background bash shell. Takes a shell_id parameter identifying the shell. Always returns only new output since the last check. Returns command output along with shell status.',
        inputSchema: bashOutputInputSchema.shape,
        handler: async (input: BashOutputInput) => {
          try {
            const output = await bashTool.getOutput(input);
            return {
              content: [
                {
                  type: 'text',
                  text: output.output,
                },
              ],
              structuredContent: output,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to retrieve bash output: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      }),
      tool({
        name: 'kill-bash',
        description:
          'Kills a running background shell by its ID. Takes a shell_id parameter identifying the shell to kill, and an optional signal parameter to send to the shell. Returns a success or failure status.',
        inputSchema: killShellInputSchema.shape,
        handler: async (input: KillShellInput) => {
          try {
            const output = await bashTool.killShell(input);
            return {
              content: [
                {
                  type: 'text',
                  text: `Shell ${input.shell_id} ${output.killed ? 'killed' : 'not found'}`,
                },
              ],
              structuredContent: output,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to kill bash shell: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      }),
    ],
  };
}
