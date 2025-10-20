import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Handler function for a remote tool.
 * Returns a CallToolResult conforming to MCP protocol.
 */
export type ToolHandler<TInput> = (
  input: TInput,
) => Promise<CallToolResult>;

/**
 * Remote instance that exposes tool handlers.
 * All implementations (SSH, Container, etc.) should conform to this structure.
 */
export type RemoteInstance = {
  bash: {
    handler: ToolHandler<{
      command: string;
      timeout?: number;
      description?: string;
      run_in_background?: boolean;
    }>;
  };
  bashOutput: {
    handler: ToolHandler<{
      shell_id: string;
    }>;
  };
  killBash: {
    handler: ToolHandler<{
      shell_id: string;
      signal?: string;
    }>;
  };
  read: {
    handler: ToolHandler<{
      file_path: string;
      offset?: number;
      limit?: number;
    }>;
  };
  write: {
    handler: ToolHandler<{
      file_path: string;
      content: string;
    }>;
  };
  edit: {
    handler: ToolHandler<{
      file_path: string;
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    }>;
  };
  grep: {
    handler: ToolHandler<{
      pattern: string;
      path: string;
      glob?: string;
      output_mode?: 'content' | 'files_with_matches' | 'count';
      '-B'?: number;
      '-A'?: number;
      '-C'?: number;
      '-n'?: boolean;
      '-i'?: boolean;
      head_limit?: number;
    }>;
  };
  glob: {
    handler: ToolHandler<{
      base_path: string;
      pattern: string;
      include_hidden?: boolean;
    }>;
  };
};

/**
 * Test environment configuration for integration tests.
 */
export type TestEnvironment = {
  /** Base path in the remote environment where test fixtures are located */
  fixturesPath: string;
  /** Base path for writing temporary test files */
  testFilesPath: string;
};

/**
 * Provider interface for integration tests.
 * Each remote implementation (SSH, Container, etc.) should implement this.
 */
export type RemoteProvider = {
  /** Name of the provider (e.g., 'SSH', 'Container') */
  name: string;
  /** Creates and connects to a remote instance */
  connect: () => Promise<RemoteInstance>;
  /** Disconnects and cleans up a remote instance */
  disconnect: (remote: RemoteInstance) => Promise<void>;
  /** Returns test environment configuration */
  getTestEnvironment: () => TestEnvironment;
};
