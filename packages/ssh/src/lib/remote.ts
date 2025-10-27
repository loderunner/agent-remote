import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type {
  BashInput,
  BashOutputInput,
  BashOutputToolDefinition,
  BashToolDefinition,
  EditToolDefinition,
  FileEditInput,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GlobToolDefinition,
  GrepInput,
  GrepToolDefinition,
  KillBashToolDefinition,
  KillShellInput,
  ReadToolDefinition,
  WriteToolDefinition,
} from '@agent-remote/core';
import {
  bashInputSchema,
  bashOutputInputSchema,
  fileEditInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
  globInputSchema,
  grepInputSchema,
  killShellInputSchema,
} from '@agent-remote/core';
import { formatPatch } from 'diff';
import { Client, ConnectConfig, SFTPWrapper } from 'ssh2';
import { ZodError } from 'zod';
import { fromError } from 'zod-validation-error/v3';

import packageJson from '../../package.json';

import { BashTool } from './bash';
import { FileTool } from './file';
import { GlobTool } from './glob';
import { GrepTool } from './grep';

function formatErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return fromError(error).toString();
  } else if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Remote SSH connection manager that provides tools for executing commands and
 * managing files on remote systems.
 *
 * @example
 * ```typescript
 * const remote = await Remote.connect({
 *   host: 'example.com',
 *   username: 'user',
 *   privateKey: fs.readFileSync('/path/to/key'),
 * });
 *
 * // Use individual tools
 * const bashResult = await remote.bash.handler({ command: 'ls -la' });
 * const fileResult = await remote.read.handler({ file_path: '/etc/hosts' });
 *
 * // Or create an "MCP server" for the Claude Agent SDK
 * const server = remote.createSdkMcpServer();
 *
 * // Clean up when done
 * await remote.disconnect();
 * ```
 */
export class Remote {
  private client: Client;
  private sftp?: SFTPWrapper;
  private bashTool?: BashTool;
  private grepTool?: GrepTool;
  private globTool?: GlobTool;
  private fileTool?: FileTool;

  private constructor(client: Client, sftp?: SFTPWrapper) {
    this.client = client;
    this.sftp = sftp;
  }

  /**
   * Establishes a connection to a remote SSH server.
   *
   * @param config - SSH connection configuration (host, username, auth, etc.)
   * @returns A connected Remote instance
   * @throws If the SSH connection fails
   *
   * @example
   * ```typescript
   * // Connect with password
   * const remote = await Remote.connect({
   *   host: 'example.com',
   *   username: 'user',
   *   password: 'secret',
   * });
   *
   * // Connect with private key
   * const remote = await Remote.connect({
   *   host: 'example.com',
   *   username: 'user',
   *   privateKey: fs.readFileSync('/path/to/id_rsa'),
   * });
   * ```
   */
  static async connect(config: ConnectConfig): Promise<Remote> {
    const client = new Client();
    await new Promise<void>((resolve, reject) => {
      client.on('ready', () => {
        resolve();
      });
      client.on('error', (err) => {
        reject(err);
      });
      client.connect(config);
    });

    // Try to start SFTP, but don't fail if it's not available
    const sftp = await new Promise<SFTPWrapper | undefined>((resolve) => {
      client.sftp((err, sftp) => {
        if (err) {
          // SFTP not available, file operations will be disabled
          resolve(undefined);
          return;
        }
        resolve(sftp);
      });
    });

    return new Remote(client, sftp);
  }

  /**
   * Closes the SSH connection and SFTP session.
   *
   * @example
   * ```typescript
   * const remote = await Remote.connect(config);
   * try {
   *   // Use remote tools...
   * } finally {
   *   await remote.disconnect();
   * }
   * ```
   */
  async disconnect(): Promise<void> {
    if (this.sftp) {
      this.sftp.end();
    }
    this.client.end();
  }

  /**
   * Bash command execution tool.
   * Executes commands in a persistent shell session with optional timeout.
   * For terminal operations like git, npm, docker, etc.
   */
  get bash(): BashToolDefinition {
    this.bashTool ??= new BashTool(this.client);
    const tool = this.bashTool;

    return {
      name: 'bash',
      description:
        'Executes a bash command in a persistent shell session with optional timeout. For terminal operations like git, npm, docker, etc. DO NOT use for file operations - use specialized tools instead.',
      inputSchema: bashInputSchema,
      handler: async (input: BashInput) => {
        try {
          const output = await tool.execute(input);
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
                text: `Failed to execute bash command: ${formatErrorMessage(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    };
  }

  /**
   * Bash output retrieval tool.
   * Retrieves output from a running or completed background bash shell.
   */
  get bashOutput(): BashOutputToolDefinition {
    this.bashTool ??= new BashTool(this.client);
    const tool = this.bashTool;

    return {
      name: 'bash-output',
      description:
        'Retrieves output from a running or completed background bash shell. Takes a shell_id parameter identifying the shell. Always returns only new output since the last check. Returns command output along with shell status.',
      inputSchema: bashOutputInputSchema,
      handler: async (input: BashOutputInput) => {
        try {
          const output = await tool.getOutput(input);
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
                text: `Failed to retrieve bash output: ${formatErrorMessage(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    };
  }

  /**
   * Bash shell kill tool.
   * Kills a running background shell by its ID.
   */
  get killBash(): KillBashToolDefinition {
    this.bashTool ??= new BashTool(this.client);
    const tool = this.bashTool;

    return {
      name: 'kill-bash',
      description:
        'Kills a running background shell by its ID. Takes a shell_id parameter identifying the shell to kill, and an optional signal parameter to send to the shell. Returns a success or failure status.',
      inputSchema: killShellInputSchema,
      handler: async (input: KillShellInput) => {
        try {
          const output = await tool.killShell(input);
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
                text: `Failed to kill bash shell: ${formatErrorMessage(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    };
  }

  /**
   * Grep search tool.
   * Searches for patterns in files or directories.
   */
  get grep(): GrepToolDefinition {
    this.grepTool ??= new GrepTool(this.client);
    const tool = this.grepTool;

    return {
      name: 'grep',
      description:
        'Searches for a pattern in a file or directory. Takes a pattern parameter to search for, and an optional path parameter to search in. Returns a list of files that match the pattern.',
      inputSchema: grepInputSchema,
      handler: async (input: GrepInput) => {
        try {
          const output = await tool.grep(input);
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
                text: `Failed to grep: ${formatErrorMessage(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    };
  }

  /**
   * File read tool.
   * Reads files from the remote filesystem.
   */
  get read(): ReadToolDefinition {
    this.fileTool ??= new FileTool(this.sftp ?? this.client);
    const tool = this.fileTool;

    return {
      name: 'read',
      description:
        'Reads a file from the filesystem. Takes an absolute file path and optional offset/limit parameters for partial reads. Returns content with line numbers in cat -n format.',
      inputSchema: fileReadInputSchema,
      handler: async (input: FileReadInput) => {
        try {
          const output = await tool.read(input);
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
                text: `Failed to read file: ${formatErrorMessage(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    };
  }

  /**
   * File write tool.
   * Writes content to files on the remote filesystem.
   */
  get write(): WriteToolDefinition {
    this.fileTool ??= new FileTool(this.sftp ?? this.client);
    const tool = this.fileTool;

    return {
      name: 'write',
      description:
        'Writes content to a file on the filesystem. Takes an absolute file path and content to write. Creates or overwrites the file.',
      inputSchema: fileWriteInputSchema,
      handler: async (input: FileWriteInput) => {
        try {
          const output = await tool.write(input);
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
                text: `Failed to write file: ${formatErrorMessage(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    };
  }

  /**
   * File edit tool.
   * Edits files by replacing text on the remote filesystem.
   */
  get edit(): EditToolDefinition {
    this.fileTool ??= new FileTool(this.sftp ?? this.client);
    const tool = this.fileTool;

    return {
      name: 'edit',
      description:
        'Edits a file by replacing text. Takes an absolute file path, old_string to find, new_string to replace with, and optional replace_all flag. Returns a unified diff of the changes.',
      inputSchema: fileEditInputSchema,
      handler: async (input: FileEditInput) => {
        try {
          const output = await tool.edit(input);
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
                text: `Failed to edit file: ${formatErrorMessage(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    };
  }

  /**
   * Glob file search tool.
   * Searches for files matching glob patterns.
   */
  get glob(): GlobToolDefinition {
    this.globTool ??= new GlobTool(this.client);
    const tool = this.globTool;

    return {
      name: 'glob',
      description:
        'Searches for files matching a glob pattern. Takes an absolute base path and a glob pattern supporting modern features like brace expansion, globstar (**), and POSIX character classes. Returns a list of matching file paths.',
      inputSchema: globInputSchema,
      handler: async (input: GlobInput) => {
        try {
          const output = await tool.glob(input);
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
                text: `Failed to glob: ${formatErrorMessage(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    };
  }

  /**
   * Creates an MCP server with all remote tools from this Remote instance.
   * This is a convenience method that integrates with the Claude Agent SDK.
   *
   * @param name - Optional name for the MCP server (defaults to 'remote-ssh')
   * @returns An MCP server instance from the Agent SDK
   *
   * @example
   * ```typescript
   * const remote = await Remote.connect({
   *   host: 'example.com',
   *   username: 'user',
   *   privateKey: fs.readFileSync('/path/to/key'),
   * });
   *
   * const server = remote.createSdkMcpServer();
   *
   * // Use with Agent SDK...
   * ```
   */
  createSdkMcpServer(name: string = 'remote-ssh') {
    return createSdkMcpServer({
      name,
      version: packageJson.version,
      tools: [
        tool(
          this.bash.name,
          this.bash.description,
          this.bash.inputSchema.shape,
          (args: BashInput) => this.bash.handler(args),
        ),
        tool(
          this.bashOutput.name,
          this.bashOutput.description,
          this.bashOutput.inputSchema.shape,
          (args: BashOutputInput) => this.bashOutput.handler(args),
        ),
        tool(
          this.killBash.name,
          this.killBash.description,
          this.killBash.inputSchema.shape,
          this.killBash.handler,
        ),
        tool(
          this.grep.name,
          this.grep.description,
          this.grep.inputSchema.shape,
          this.grep.handler,
        ),
        tool(
          this.read.name,
          this.read.description,
          this.read.inputSchema.shape,
          this.read.handler,
        ),
        tool(
          this.write.name,
          this.write.description,
          this.write.inputSchema.shape,
          this.write.handler,
        ),
        tool(
          this.edit.name,
          this.edit.description,
          this.edit.inputSchema.shape,
          this.edit.handler,
        ),
        tool(
          this.glob.name,
          this.glob.description,
          this.glob.inputSchema.shape,
          this.glob.handler,
        ),
      ],
    });
  }
}
