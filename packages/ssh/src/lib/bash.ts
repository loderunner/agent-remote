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
   * Command output - combined stdout and stderr
   */
  output: string;
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
   * The output of the command - combined stdout and stderr
   */
  output: string;
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
    if (!this.shell) {
      this.shell = await new Promise<ClientChannel>((resolve, reject) => {
        this.client.shell(
          {
            modes: { ECHO: 0, ONLRET: 0, ONLCR: 0 },
            term: 'dumb',
          },
          (err, channel) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(channel);
          },
        );
      });
      this.shell.on('close', () => {
        this.shell = null;
      });
    }

    return this.shell;
  }

  private async executeInForeground(input: BashInput): Promise<BashOutput> {
    const abortSignal = AbortSignal.timeout(input.timeout ?? 60000);
    const shell = await this.init();

    return new Promise((resolve, reject) => {
      const startMarker = `__CMD_START_${Date.now()}_${nanoid()}__`;
      const endMarker = `__CMD_END_${Date.now()}_${nanoid()}__`;
      const command =
        `echo "${startMarker}"; ` + input.command + `; echo "${endMarker}:$?"`;

      let buffer = '';
      let timedOut = false;

      const onData = (data: Buffer) => {
        // Don't accumulate output after timeout, just consume it
        if (timedOut) {
          return;
        }

        // Accumulate data into buffer
        buffer += data.toString();

        // Check if we've received the start marker first
        const startIndex = buffer.indexOf(startMarker);
        if (startIndex === -1) {
          return;
        }

        // Then look for end marker AFTER the start marker
        const endIndex = buffer.indexOf(endMarker, startIndex);
        if (endIndex === -1) {
          return;
        }

        // Wait for newline after end marker
        // The end marker format is: __CMD_END_xxx__:exit_code\n
        const markerEnd = endIndex + endMarker.length;
        const newlineIndex = buffer.indexOf('\n', markerEnd);
        if (newlineIndex === -1) {
          return; // Full end marker hasn't arrived yet
        }

        // Extract output between start and end markers
        // Skip the start marker line and any newlines after it
        const afterStart = startIndex + startMarker.length;
        const nextLineAfterStart = buffer.indexOf('\n', afterStart);
        const outputStart =
          nextLineAfterStart !== -1 ? nextLineAfterStart + 1 : afterStart;
        const output = buffer.slice(outputStart, endIndex);

        // Extract exit code between marker and newline (e.g., ":0")
        const exitCodePart = buffer.slice(markerEnd, newlineIndex);
        const colonIndex = exitCodePart.indexOf(':');
        const exitCode =
          colonIndex !== -1
            ? Number.parseInt(exitCodePart.slice(colonIndex + 1))
            : undefined;

        this.shell?.removeListener('data', onData);
        this.shell?.removeListener('error', onError);

        const trimmed = output.trim();
        resolve({
          output: trimmed ? trimmed + '\n' : '',
          exitCode: Number.isNaN(exitCode) ? undefined : exitCode,
        });
      };
      const onError = (err: unknown) => {
        this.shell?.removeListener('data', onData);
        this.shell?.removeListener('error', onError);
        reject(err);
      };
      shell.on('data', onData);
      shell.on('error', onError);

      abortSignal.addEventListener('abort', () => {
        // Mark as timed out but keep listeners to consume the end marker
        timedOut = true;
        // Send Ctrl+C to interrupt, then send two newlines to clear any partial input
        // and ensure we're at a clean prompt
        this.shell?.write('\x03\n\n');

        // Set a cleanup timeout - if end marker doesn't arrive within a reasonable time,
        // forcefully remove the listeners to prevent them from interfering with future commands
        setTimeout(() => {
          this.shell?.removeListener('data', onData);
          this.shell?.removeListener('error', onError);
        }, 500);

        // Extract output before the interrupt
        const output = buffer.slice(0, buffer.lastIndexOf('\n') + 1);

        // Resolve immediately but listeners stay active to clean up
        resolve({
          output,
          killed: true,
        });
      });

      shell.write(command + '\n');
    });
  }

  private async executeInBackground(input: BashInput): Promise<BashOutput> {
    const abortSignal = AbortSignal.timeout(input.timeout ?? 60000);
    const shellId = nanoid();

    const channel = await new Promise<ClientChannel>((resolve, reject) => {
      this.client.exec(
        input.command,
        // {
        //   pty: {
        //     modes: { ECHO: 0, ONLRET: 0, ONLCR: 0, OPOST: 0 },
        //     term: 'dumb',
        //   },
        // },
        (err, channel) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(channel);
        },
      );
    });

    this.shells.set(shellId, {
      output: '',
      status: 'running',
      channel,
    });
    channel.on('data', (data: Buffer) => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        throw new Error('Shell not found');
      }
      const text = data.toString();
      shell.output += text;
    });
    channel.stderr.on('data', (data: Buffer) => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        throw new Error('Shell not found');
      }
      const text = data.toString();
      shell.output += text;
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
      void this.killShell({ shell_id: shellId });
    });

    channel.write(input.command + '\n');

    return { output: '', shellId };
  }

  public async getOutput(input: BashOutputInput): Promise<BashOutputOutput> {
    const shell = this.shells.get(input.shell_id);
    if (!shell) {
      throw new Error('Shell not found');
    }
    let { output } = shell;
    if (input.filter) {
      const regex = new RegExp(input.filter);
      output = output
        .split('\n')
        .filter((line) => regex.test(line))
        .join('\n');
    }
    shell.output = '';
    return {
      output,
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
