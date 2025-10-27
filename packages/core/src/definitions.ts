import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type {
  BashInput,
  BashOutputInput,
  KillShellInput,
  bashInputSchema,
  bashOutputInputSchema,
  killShellInputSchema,
} from './bash';
import type {
  FileEditInput,
  FileReadInput,
  FileWriteInput,
  fileEditInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
} from './file';
import type { GlobInput, globInputSchema } from './glob';
import type { GrepInput, grepInputSchema } from './grep';

/**
 * Tool definition for bash command execution
 */
export type BashToolDefinition = {
  name: 'bash';
  description: string;
  inputSchema: typeof bashInputSchema;
  handler: (input: BashInput) => Promise<CallToolResult>;
};

/**
 * Tool definition for bash output retrieval
 */
export type BashOutputToolDefinition = {
  name: 'bash-output';
  description: string;
  inputSchema: typeof bashOutputInputSchema;
  handler: (input: BashOutputInput) => Promise<CallToolResult>;
};

/**
 * Tool definition for killing bash shells
 */
export type KillBashToolDefinition = {
  name: 'kill-bash';
  description: string;
  inputSchema: typeof killShellInputSchema;
  handler: (input: KillShellInput) => Promise<CallToolResult>;
};

/**
 * Tool definition for grep search
 */
export type GrepToolDefinition = {
  name: 'grep';
  description: string;
  inputSchema: typeof grepInputSchema;
  handler: (input: GrepInput) => Promise<CallToolResult>;
};

/**
 * Tool definition for file read
 */
export type ReadToolDefinition = {
  name: 'read';
  description: string;
  inputSchema: typeof fileReadInputSchema;
  handler: (input: FileReadInput) => Promise<CallToolResult>;
};

/**
 * Tool definition for file write
 */
export type WriteToolDefinition = {
  name: 'write';
  description: string;
  inputSchema: typeof fileWriteInputSchema;
  handler: (input: FileWriteInput) => Promise<CallToolResult>;
};

/**
 * Tool definition for file edit
 */
export type EditToolDefinition = {
  name: 'edit';
  description: string;
  inputSchema: typeof fileEditInputSchema;
  handler: (input: FileEditInput) => Promise<CallToolResult>;
};

/**
 * Tool definition for glob file search
 */
export type GlobToolDefinition = {
  name: 'glob';
  description: string;
  inputSchema: typeof globInputSchema;
  handler: (input: GlobInput) => Promise<CallToolResult>;
};
