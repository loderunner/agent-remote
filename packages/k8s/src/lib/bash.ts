import type {
  ChildProcess,
  ChildProcessWithoutNullStreams,
} from 'node:child_process';
import { spawn } from 'node:child_process';

import type {
  BashInput,
  BashOutput,
  BashOutputInput,
  BashOutputOutput,
  KillShellInput,
  KillShellOutput,
} from '@agent-remote/core';
import {
  bashInputSchema,
  bashOutputInputSchema,
  killShellInputSchema,
} from '@agent-remote/core';
import { customAlphabet } from 'nanoid';

import { ToolConfig } from './remote';

const nanoid = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  8,
);

type Shell = BashOutputOutput & {
  process: ChildProcess;
};

export class BashTool {
  private readonly pod: string;
  private readonly namespace: string;
  private readonly container?: string;
  private readonly shellCommand: string;
  private shellProcess: ChildProcessWithoutNullStreams | null = null;
  private readonly shells = new Map<string, Shell>();

  constructor(config: ToolConfig) {
    this.pod = config.pod;
    this.namespace = config.namespace;
    this.container = config.container;
    this.shellCommand = config.shell;
  }

  public async execute(input: BashInput): Promise<BashOutput> {
    bashInputSchema.parse(input);

    if (input.run_in_background) {
      return this.executeInBackground(input);
    }

    return this.executeInForeground(input);
  }

  public async init(): Promise<ChildProcessWithoutNullStreams> {
    if (!this.shellProcess || this.shellProcess.exitCode !== null) {
      const args = [
        'exec',
        '-i',
        '-n',
        this.namespace,
        this.pod,
      ];
      
      if (this.container) {
        args.push('-c', this.container);
      }
      
      args.push('--', this.shellCommand);

      this.shellProcess = spawn('kubectl', args);

      this.shellProcess.on('close', () => {
        this.shellProcess = null;
      });

      this.shellProcess.on('error', () => {
        this.shellProcess = null;
      });
    }

    return this.shellProcess;
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

      const onStdout = (data: Buffer) => {
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

        shell.stdout.removeListener('data', onStdout);
        shell.stderr.removeListener('data', onStderr);
        shell.removeListener('error', onError);

        const trimmed = output.trim();
        resolve({
          output: trimmed ? trimmed + '\n' : '',
          exitCode: Number.isNaN(exitCode) ? undefined : exitCode,
        });
      };

      const onStderr = (data: Buffer) => {
        // Stderr data - include it in the output
        if (!timedOut) {
          buffer += data.toString();
        }
      };

      const onError = (err: unknown) => {
        shell.stdout.removeListener('data', onStdout);
        shell.stderr.removeListener('data', onStderr);
        reject(err);
      };

      shell.stdout.on('data', onStdout);
      shell.stderr.on('data', onStderr);
      shell.on('error', onError);

      abortSignal.addEventListener('abort', () => {
        // Mark as timed out
        timedOut = true;

        // Clean up listeners immediately
        shell.stdout.removeListener('data', onStdout);
        shell.stderr.removeListener('data', onStderr);
        shell.removeListener('error', onError);

        // Kill the persistent shell - it's in an unknown state after timeout
        shell.kill();
        this.shellProcess = null;

        // Extract output before the interrupt
        const output = buffer.slice(0, buffer.lastIndexOf('\n') + 1);

        resolve({
          output,
          killed: true,
        });
      });

      shell.stdin.write(command + '\n');
    });
  }

  private async executeInBackground(input: BashInput): Promise<BashOutput> {
    const abortSignal = AbortSignal.timeout(input.timeout ?? 60000);
    const shellId = nanoid();

    const args = [
      'exec',
      '-n',
      this.namespace,
      this.pod,
    ];
    
    if (this.container) {
      args.push('-c', this.container);
    }
    
    args.push('--', this.shellCommand, '-c', input.command);

    const process = spawn('kubectl', args);

    this.shells.set(shellId, {
      output: '',
      status: 'running',
      process,
    });

    process.stdout.on('data', (data: Buffer) => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        return;
      }
      const text = data.toString();
      shell.output += text;
    });

    process.stderr.on('data', (data: Buffer) => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        return;
      }
      const text = data.toString();
      shell.output += text;
    });

    process.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        return;
      }
      shell.exitCode = code ?? undefined;
      shell.signal = signal ?? undefined;
    });

    process.on('close', () => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        return;
      }
      shell.status = 'completed';
      shell.process.removeAllListeners();
    });

    abortSignal.addEventListener('abort', () => {
      const shell = this.shells.get(shellId);
      if (!shell) {
        return;
      }
      void this.killShell({ shell_id: shellId });
    });

    return { output: '', shellId };
  }

  public async getOutput(input: BashOutputInput): Promise<BashOutputOutput> {
    bashOutputInputSchema.parse(input);

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

  public async getStatus(
    input: BashOutputInput,
  ): Promise<BashOutputOutput['status']> {
    const shell = this.shells.get(input.shell_id);
    if (!shell) {
      throw new Error('Shell not found');
    }
    return shell.status;
  }

  public async killShell(input: KillShellInput): Promise<KillShellOutput> {
    killShellInputSchema.parse(input);

    const shell = this.shells.get(input.shell_id);
    if (!shell) {
      return { killed: false };
    }

    return new Promise((resolve) => {
      shell.process.on('close', () => {
        resolve({ killed: true });
      });

      shell.process.on('error', () => {
        resolve({ killed: false });
      });

      // Node.js expects 'SIGTERM', 'SIGKILL', etc.
      // Normalize the signal name
      const baseSignal = input.signal ?? 'KILL';
      const signal = (
        baseSignal.startsWith('SIG') ? baseSignal : `SIG${baseSignal}`
      ) as NodeJS.Signals;

      shell.process.kill(signal);
    });
  }
}
