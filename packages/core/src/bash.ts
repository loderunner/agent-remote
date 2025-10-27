import z, { ZodType } from 'zod';

/**
 * Input for bash command execution
 */
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

/**
 * Output from bash command execution
 */
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

/**
 * Input for retrieving bash output from a background shell
 */
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

/**
 * Output from retrieving bash output
 */
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

/**
 * Signal types for killing background shells
 */
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

/**
 * Input for killing a background shell
 */
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

/**
 * Output from killing a background shell
 */
export type KillShellOutput = {
  /**
   * Whether the shell was killed
   */
  killed: boolean;
};
