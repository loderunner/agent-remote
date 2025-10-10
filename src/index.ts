import { Client, ConnectConfig } from 'ssh2';

import {
  BashInput,
  BashOutputInput,
  BashTool,
  KillShellInput,
  bashInputSchema,
  bashOutputInputSchema,
  killShellInputSchema,
} from './bash';

/**
 *
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
      {
        name: 'bash',
        description:
          'Executes a bash command in a persistent shell session with optional timeout. For terminal operations like git, npm, docker, etc. DO NOT use for file operations - use specialized tools instead.',
        inputSchema: bashInputSchema,
        handler: (input: BashInput) => {
          return bashTool.execute(input);
        },
      },
      {
        name: 'bash-output',
        description:
          'Retrieves output from a running or completed background bash shell. Takes a shell_id parameter identifying the shell. Always returns only new output since the last check. Returns stdout and stderr output along with shell status.',
        inputSchema: bashOutputInputSchema,
        handler: (input: BashOutputInput) => {
          return bashTool.getOutput(input);
        },
      },
      {
        name: 'kill-shell',
        description:
          'Kills a running background shell by its ID. Takes a shell_id parameter identifying the shell to kill. Returns a success or failure status.',
        inputSchema: killShellInputSchema,
        handler: (input: KillShellInput) => {
          return bashTool.killShell(input);
        },
      },
    ] as const,
  } as const;
}
