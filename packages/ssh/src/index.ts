import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { formatPatch } from 'diff';
import { Client, ConnectConfig, SFTPWrapper } from 'ssh2';
import type { ZodRawShape } from 'zod';

import {
  BashInput,
  BashOutputInput,
  BashTool,
  KillShellInput,
  bashInputSchema,
  bashOutputInputSchema,
  killShellInputSchema,
} from './bash';
import {
  FileEditInput,
  FileReadInput,
  FileTool,
  FileWriteInput,
  fileEditInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
} from './file';
import { GlobInput, GlobTool, globInputSchema } from './glob';
import { GrepInput, GrepTool, grepInputSchema } from './grep';

export type RemoteTool<TInput = unknown> = {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (input: TInput) => Promise<CallToolResult>;
};

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
  const grepTool = new GrepTool(client);
  const globTool = new GlobTool(client);

  const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(sftp);
    });
  });
  const fileTool = new FileTool(sftp);

  return {
    disconnect: () => {
      sftp.end();
      client.end();
    },
    tools: {
      bash: {
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
      },
      'bash-output': {
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
      },
      'kill-bash': {
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
      },
      grep: {
        name: 'grep',
        description:
          'Searches for a pattern in a file or directory. Takes a pattern parameter to search for, and an optional path parameter to search in. Returns a list of files that match the pattern.',
        inputSchema: grepInputSchema.shape,
        handler: async (input: GrepInput) => {
          try {
            const output = await grepTool.grep(input);
            let text = '';
            if (output.mode === 'content') {
              text = output.content;
            } else if (output.mode === 'files_with_matches') {
              text = `Found ${output.numFiles} files\n${output.filenames.join('\n')}`;
            } else if (output.mode === 'count') {
              text = `Found ${output.numMatches} matches`;
            }
            return {
              content: [
                {
                  type: 'text',
                  text,
                },
              ],
              structuredContent: output,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to grep: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      },
      read: {
        name: 'read',
        description:
          'Reads a file from the filesystem. Takes an absolute file path and optional offset/limit parameters for partial reads. Returns content with line numbers in cat -n format.',
        inputSchema: fileReadInputSchema.shape,
        handler: async (input: FileReadInput) => {
          try {
            const output = await fileTool.read(input);
            const lines = output.content.split('\n');
            const maxLineNumber = output.startLine + lines.length - 1;
            const padding = maxLineNumber.toString().length;
            const numberedLines = lines.map((line, index) => {
              const lineNumber = output.startLine + index;
              return `${lineNumber.toString().padStart(padding)}\t${line}`;
            });
            const text = numberedLines.join('\n');
            return {
              content: [
                {
                  type: 'text',
                  text,
                },
              ],
              structuredContent: output,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      },
      write: {
        name: 'write',
        description:
          'Writes content to a file on the filesystem. Takes an absolute file path and content to write. Creates or overwrites the file.',
        inputSchema: fileWriteInputSchema.shape,
        handler: async (input: FileWriteInput) => {
          try {
            const output = await fileTool.write(input);
            return {
              content: [
                {
                  type: 'text',
                  text: `Successfully wrote to ${input.file_path}`,
                },
              ],
              structuredContent: output,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      },
      edit: {
        name: 'edit',
        description:
          'Edits a file by replacing text. Takes an absolute file path, old_string to find, new_string to replace with, and optional replace_all flag. Returns a unified diff of the changes.',
        inputSchema: fileEditInputSchema.shape,
        handler: async (input: FileEditInput) => {
          try {
            const output = await fileTool.edit(input);
            let text = `Made ${output.replacements} replacement${output.replacements === 1 ? '' : 's'} in ${input.file_path}`;

            if (output.diff.hunks.length > 0) {
              text += '\n\n';
              text += formatPatch(output.diff).split('\n').slice(2).join('\n');
            }

            return {
              content: [
                {
                  type: 'text',
                  text,
                },
              ],
              structuredContent: output,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      },
      glob: {
        name: 'glob',
        description:
          'Searches for files matching a glob pattern. Takes an absolute base path and a glob pattern supporting modern features like brace expansion, globstar (**), and POSIX character classes. Returns a list of matching file paths.',
        inputSchema: globInputSchema.shape,
        handler: async (input: GlobInput) => {
          try {
            const output = await globTool.glob(input);
            const text = `Found ${output.count} match${output.count === 1 ? '' : 'es'}\n${output.matches.join('\n')}`;
            return {
              content: [
                {
                  type: 'text',
                  text,
                },
              ],
              structuredContent: output,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to glob: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      },
    },
  };
}
