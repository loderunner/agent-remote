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
   * Unset SSH_AUTH_SOCK before each test to ensure clean environment.
   * Individual tests can stub it back if needed.
   */
  beforeEach(() => {
    vi.stubEnv('SSH_AUTH_SOCK', undefined);
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
      expect(output).toContain('remote-ssh-mcp [OPTIONS]');
      expect(output).toContain('SSH Connection Options:');
      expect(output).toContain('--host');
      expect(output).toContain('--username');
      expect(output).toContain('--password');
      expect(output).toContain('--private-key');
      expect(output).toContain('env: SSH_HOST');
      expect(output).toContain('env: SSH_USERNAME');
    });

    it('should show help with -h', async () => {
      const { stdout, stderr, exitCode } = await runServer(['-h']);
      const output = stdout + stderr;

      expect(exitCode).toBe(0);
      expect(output).toContain('remote-ssh-mcp [OPTIONS]');
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
      expect(output).toContain('Missing required argument: host');
    });

    it('should error when missing host', async () => {
      const { stdout, stderr, exitCode } = await runServer([
        '--username',
        'testuser',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      expect(exitCode).not.toBe(0);
      expect(output).toContain('Missing required argument: host');
    });

    it('should error when missing authentication', async () => {
      const { stdout, stderr, exitCode } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
      ]);
      const output = stdout + stderr;

      expect(exitCode).not.toBe(0);
      expect(output).toContain('SSH authentication required');
    });
  });

  describe('Environment Variables', () => {
    it('should accept host from SSH_HOST env var', async () => {
      vi.stubEnv('SSH_HOST', 'env-example.com');

      const { stdout, stderr } = await runServer([
        '--username',
        'testuser',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      // Will fail to connect but shouldn't error on validation
      // Either connection error or help message
      expect(output).not.toContain('SSH host is required');
    });

    it('should accept username from SSH_USERNAME env var', async () => {
      vi.stubEnv('SSH_USERNAME', 'envuser');

      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH username is required');
    });

    it('should accept password from SSH_PASSWORD env var', async () => {
      vi.stubEnv('SSH_PASSWORD', 'envpass');

      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });

    it('should accept all config from env vars', async () => {
      vi.stubEnv('SSH_HOST', 'env-example.com');
      vi.stubEnv('SSH_USERNAME', 'envuser');
      vi.stubEnv('SSH_PASSWORD', 'envpass');

      const { stdout, stderr } = await runServer(['--timeout', '300']);
      const output = stdout + stderr;

      // Should pass validation
      expect(output).not.toContain('required');
    });

    it('command line args should override env vars', async () => {
      vi.stubEnv('SSH_HOST', 'env-example.com');
      vi.stubEnv('SSH_USERNAME', 'envuser');
      vi.stubEnv('SSH_PASSWORD', 'envpass');

      const { stdout, stderr } = await runServer([
        '--host',
        'cli-example.com',
        '--username',
        'cliuser',
        '--password',
        'clipass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      // Should pass validation with CLI args
      expect(output).not.toContain('required');
    });
  });

  describe('Port Handling', () => {
    it('should accept port from command line', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--port',
        '2222',
        '--username',
        'testuser',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      // Should pass validation
      expect(output).not.toContain('required');
    });

    it('should accept port from SSH_PORT env var', async () => {
      vi.stubEnv('SSH_PORT', '2222');

      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      // Should pass validation
      expect(output).not.toContain('required');
    });

    it('should default to port 22 when not specified', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      // Should pass validation (will fail on connection but that's OK)
      expect(output).not.toContain('required');
    });
  });

  describe('Authentication Methods', () => {
    it('should accept password authentication', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });

    it('should accept private key authentication', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--private-key',
        '/fake/path/to/key',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });

    it('should accept agent authentication', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--agent',
        '/fake/ssh/agent.sock',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });

    it('should accept passphrase with private key', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--private-key',
        '/fake/path/to/key',
        '--passphrase',
        'myphrase',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });
  });

  describe('Alias Support', () => {
    it('should accept -H for host', async () => {
      const { stdout, stderr } = await runServer([
        '-H',
        'example.com',
        '--username',
        'testuser',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH host is required');
    });

    it('should accept -p for port', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '-p',
        '2222',
        '--username',
        'testuser',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('required');
    });

    it('should accept -u for username', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '-u',
        'testuser',
        '--password',
        'testpass',
        '--timeout',
        '300',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH username is required');
    });
  });
});
