export { Remote } from './remote';
export { BashTool } from './bash';
export { FileTool } from './file';
export { GlobTool } from './glob';
export { GrepTool } from './grep';

export type {
  BashOutputToolDefinition,
  BashToolDefinition,
  EditToolDefinition,
  GlobToolDefinition,
  GrepToolDefinition,
  KillBashToolDefinition,
  ReadToolDefinition,
  WriteToolDefinition,
} from '@agent-remote/core';
export type {
  BashInput,
  BashOutput,
  BashOutputInput,
  BashOutputOutput,
  KillShellInput,
  KillShellOutput,
} from '@agent-remote/core';
export type {
  FileEditInput,
  FileEditOutput,
  FileReadInput,
  FileReadOutput,
  FileWriteInput,
  FileWriteOutput,
} from '@agent-remote/core';
export type { GrepInput, GrepOutput } from '@agent-remote/core';
export type { GlobInput, GlobOutput } from '@agent-remote/core';

export type { ConnectConfig } from 'ssh2';
