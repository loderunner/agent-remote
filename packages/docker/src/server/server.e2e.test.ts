/**
 * End-to-end tests for the MCP server executable.
 * These tests run the actual built server script and validate outputs.
 *
 * By default, these tests are SKIPPED because they take ~30s to build and run.
 *
 * To run them, use:
 * pnpm test:e2e
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

import { build } from 'tsdown';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { serverTarget } from '../../tsdown.config';

const execFileAsync = promisify(execFile);

/**
 * Helper to run the server with args and capture output.
 * The spawned process inherits the current process.env.
 */
async function runServer(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'node',
      ['dist/server.js', ...args],
      {
        env: process.env,
        timeout: 5000,
      },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'stdout' in error &&
      'stderr' in error
    ) {
      const execError = error as {
        code: number;
        stdout: string;
        stderr: string;
      };
      return {
        stdout: execError.stdout,
        stderr: execError.stderr,
        exitCode: execError.code,
      };
    }
    throw error;
  }
}

describe('MCP Server Executable - End-to-End Tests', () => {
  /**
   * Build the server to a temporary location before running tests.
   * This ensures we're testing the latest code without interfering
   * with the user's actual build in dist/.
   */
  beforeAll(async () => {
    try {
      // Build the project
      await build({ ...serverTarget, logLevel: 'silent' });

      // Use the built executable
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };
      const errorMessage = [
        'Failed to build server:',
        execError.stdout,
        execError.stderr,
      ]
        .filter(Boolean)
        .join('\n');
      throw new Error(errorMessage);
    }
  }, 120000);

  /**
   * Unset DOCKER_CONTAINER before each test to ensure clean environment.
   * Individual tests can stub it back if needed.
   */
  beforeEach(() => {
    vi.stubEnv('DOCKER_CONTAINER', undefined);
  });

  /**
   * Clean up environment stubs after each test.
   */
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Help and Version', () => {
    it('should show help with --help', async () => {
      const { stdout, stderr, exitCode } = await runServer(['--help']);
      const output = stdout + stderr;

      expect(exitCode).toBe(0);
      expect(output).toContain('remote-docker-mcp [OPTIONS]');
      expect(output).toContain('Docker Connection Options:');
      expect(output).toContain('--container');
      expect(output).toContain('--shell');
      expect(output).toContain('env: DOCKER_CONTAINER');
      expect(output).toContain('env: DOCKER_SHELL');
    });

    it('should show help with -h', async () => {
      const { stdout, stderr, exitCode } = await runServer(['-h']);
      const output = stdout + stderr;

      expect(exitCode).toBe(0);
      expect(output).toContain('remote-docker-mcp [OPTIONS]');
    });

    it('should show version with --version', async () => {
      const { stdout, exitCode } = await runServer(['--version']);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should show version with -V', async () => {
      const { stdout, exitCode } = await runServer(['-V']);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Validation Errors', () => {
    it('should error when no arguments provided', async () => {
      const { stdout, stderr, exitCode } = await runServer([]);
      const output = stdout + stderr;

      expect(exitCode).not.toBe(0);
      expect(output).toContain('Missing required argument: container');
    });

    it('should error when container is not provided', async () => {
      const { stdout, stderr, exitCode } = await runServer(['--shell', 'bash']);
      const output = stdout + stderr;

      expect(exitCode).not.toBe(0);
      expect(output).toContain('container');
    });
  });

  describe('Environment Variable Support', () => {
    it('should accept container from DOCKER_CONTAINER env var', async () => {
      vi.stubEnv('DOCKER_CONTAINER', 'test-container');

      // Test help still works with env var set
      const { stdout, stderr, exitCode } = await runServer(['--help']);
      const output = stdout + stderr;

      expect(exitCode).toBe(0);
      expect(output).toContain('remote-docker-mcp');
    });
  });
});
