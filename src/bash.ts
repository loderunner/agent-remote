import { customAlphabet } from 'nanoid';
import { Client, ClientChannel } from 'ssh2';
import z, { ZodType } from 'zod';

const nanoid = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  8,
);

export type BashInput = {
  /**
   * The command to execute
   */
  command: string;
  /**
   * Optional timeout in milliseconds (max 600000)
   */
  timeout?: number;
  /**
   * Clear, concise description of what this command does in 5-10 words
   */
  description?: string;
  /**
   * Set to true to run this command in the background
   */
  run_in_background?: boolean;
};

export const bashInputSchema = z.object({
  command: z.string().describe('The command to execute'),
  timeout: z
    .number()
    .max(600000)
    .optional()
    .describe('Optional timeout in milliseconds (max 600000)'),
  description: z
    .string()
    .optional()
    .describe(
      'Clear, concise description of what this command does in 5-10 words',
    ),
  run_in_background: z
    .boolean()
    .optional()
    .describe('Set to true to run this command in the background'),
}) satisfies ZodType<BashInput>;

export type BashOutput = {
  /**
   * stdout output
   */
  stdout: string;
  /**
   * stderr output
   */
  stderr: string;
  /**
   * Exit code of the command
   */
  exitCode?: number;
  /**
   * Signal used to terminate the command
   */
  signal?: string;
  /**
   * Whether the command was killed due to timeout
   */
  killed?: boolean;
  /**
   * Shell ID for background processes
   */
  shellId?: string;
};

export type BashOutputInput = {
  /**
   * The ID of the background shell to retrieve output from
   */
  shell_id: string;
  /**
   * Optional regex to filter output lines
   */
  filter?: string;
};

export const bashOutputInputSchema = z.object({
  shell_id: z
    .string()
    .describe('The ID of the background shell to retrieve output from'),
  filter: z
    .string()
    .optional()
    .describe('Optional regex to filter output lines'),
}) satisfies ZodType<BashOutputInput>;

export type BashOutputOutput = {
  /**
   * The stdout output of the command
   */
  stdout: string;
  /**
   * The stderr output of the command
   */
  stderr: string;
  /**
   * Current shell status
   */
  status: 'running' | 'completed';
  /**
   * Exit code (when completed)
   */
  exitCode?: number;
  /**
   * Signal (when completed)
   */
  signal?: string;
};

export type KillShellSignal =
  | 'ABRT'
  | 'ALRM'
  | 'FPE'
  | 'HUP'
  | 'ILL'
  | 'INT'
  | 'KILL'
  | 'PIPE'
  | 'QUIT'
  | 'SEGV'
  | 'TERM'
  | 'USR1'
  | 'USR2';

export type KillShellInput = {
  /**
   * The ID of the background shell to kill
   */
  shell_id: string;
  /**
   * The signal to send to the shell (default: KILL)
   */
  signal?: KillShellSignal;
};

export const killShellInputSchema = z.object({
  shell_id: z.string().describe('The ID of the background shell to kill'),
  signal: z
    .enum([
      'ABRT',
      'ALRM',
      'FPE',
      'HUP',
      'ILL',
      'INT',
      'KILL',
      'PIPE',
      'QUIT',
      'SEGV',
      'TERM',
      'USR1',
      'USR2',
    ])
    .optional()
    .describe('The signal to send to the shell (default: KILL)'),
}) satisfies ZodType<KillShellInput>;

export type KillShellOutput = {
  /**
   * Whether the shell was killed
   */
  killed: boolean;
};

export const killShellOutputSchema = z.object({
  killed: z.boolean().describe('Whether the shell was killed'),
}) satisfies ZodType<KillShellOutput>;

type Shell = BashOutputOutput & {
  channel: ClientChannel;
};

export class BashTool {
  private shell: ClientChannel | null = null;
  private readonly shells = new Map<string, Shell>();

  constructor(private readonly client: Client) {}

  public async execute(input: BashInput): Promise<BashOutput> {
    if (input.run_in_background) {
      return this.executeInBackground(input);
    }

    return this.executeInForeground(input);
  }

  public async init(): Promise<ClientChannel> {
    if (this.shell) {
      return this.shell;
    }
    this.shell = await new Promise<ClientChannel>((resolve, reject) => {
      this.client.shell(false, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(channel);
      });
    });
    this.shell.on('close', () => {
      this.shell = null;
    });

    // empty stdout and stderr
    let buf: Buffer;
    do {
      buf = this.shell.stdout.read();
    } while (buf !== null && buf.length > 0);
    do {
      buf = this.shell.stderr.read();
    } while (buf !== null && buf.length > 0);

    return this.shell;
  }

  private async executeInForeground(input: BashInput): Promise<BashOutput> {
    const abortSignal = AbortSignal.timeout(input.timeout ?? 60000);
    const shell = await this.init();

    return new Promise((resolve, reject) => {
      const endMarker = `__CMD_END_${Date.now()}_${nanoid()}__`;

      const command = input.command + ';' + `echo "${endMarker}:$?"\n`;
      let stdout = '';
      let stderr = '';
      let exitCode: number;

      const onData = (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line === command) {
            continue;
          }
          if (line.startsWith(endMarker)) {
            const [_, code] = line.split(':');
            exitCode = Number.parseInt(code);
            this.shell?.removeListener('data', onData);
            this.shell?.stderr.removeListener('data', onStderr);
            this.shell?.removeListener('error', onError);
            resolve({
              stdout,
              stderr,
              exitCode: Number.isNaN(exitCode) ? undefined : exitCode,
            });
            return;
          }
          stdout += line + '\n';
        }
      };
      const onStderr = (data: Buffer) => {
        stderr += data.toString();
      };
      const onError = (err: unknown) => {
        this.shell?.removeListener('data', onData);
        this.shell?.stderr.removeListener('data', onStderr);
        this.shell?.removeListener('error', onError);
        reject(err);
      };
      shell.on('data', onData);
      shell.stderr.on('data', onStderr);
      shell.on('error', onError);

      abortSignal.addEventListener('abort', () => {
        this.shell?.removeListener('data', onData);
        this.shell?.stderr.removeListener('data', onStderr);
        this.shell?.removeListener('error', onError);
        resolve({
          stdout,
          stderr,
          killed: true,
        });
      });

      shell.write(command);
    });
  }

  private async executeInBackground(input: BashInput): Promise<BashOutput> {
    const abortSignal = AbortSignal.timeout(input.timeout ?? 60000);
    const shellId = nanoid();

    const channel = await new Promise<ClientChannel>((resolve, reject) => {
      this.client.exec(input.command, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(channel);
      });
    });

    this.shells.set(shellId, {
      stdout: '',
      stderr: '',
      status: 'running',
      channel,
    });
    channel.on('data', (data: Buffer) => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        throw new Error('Shell not found');
      }
      shell.stdout += data.toString();
    });
    channel.stderr.on('data', (data: Buffer) => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        throw new Error('Shell not found');
      }
      shell.stderr += data.toString();
    });
    channel.on('exit', (code: number | null, signal: string | null) => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        throw new Error('Shell not found');
      }
      shell.exitCode = code ?? undefined;
      shell.signal = signal ?? undefined;
    });
    channel.on('close', () => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        throw new Error('Shell not found');
      }
      shell.status = 'completed';
      shell.channel.removeAllListeners();
    });

    abortSignal.addEventListener('abort', () => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        throw new Error('Shell not found');
      }
      this.killShell({ shell_id: shellId });
    });

    channel.write(input.command + '\n');

    return { stdout: '', stderr: '', shellId };
  }

  public async getOutput(input: BashOutputInput): Promise<BashOutputOutput> {
    const shell = this.shells.get(input.shell_id);
    if (!shell) {
      throw new Error('Shell not found');
    }
    let { stdout, stderr } = shell;
    if (input.filter) {
      const regex = new RegExp(input.filter);
      stdout = stdout
        .split('\n')
        .filter((line) => regex.test(line))
        .join('\n');
      stderr = stderr
        .split('\n')
        .filter((line) => regex.test(line))
        .join('\n');
    }
    shell.stdout = '';
    shell.stderr = '';
    return {
      stdout,
      stderr,
      status: shell.status,
      exitCode: shell.exitCode,
      signal: shell.signal,
    };
  }

  public async killShell(input: KillShellInput): Promise<KillShellOutput> {
    const shell = this.shells.get(input.shell_id);
    if (!shell) {
      return { killed: false };
    }
    return new Promise((resolve, reject) => {
      shell.channel.on('close', () => {
        resolve({ killed: true });
      });
      shell.channel.on('error', (err: unknown) => {
        reject(err);
      });
      shell.channel.signal(input.signal ?? 'KILL');
    });
  }
}
