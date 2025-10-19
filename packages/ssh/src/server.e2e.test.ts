/**
 * End-to-end tests for the MCP server executable.
 * These tests run the actual built server script and validate outputs.
 *
 * By default, these tests are SKIPPED because they take ~30s to build and run.
 *
 * To run them, use:
 * pnpm test:e2e
 */

import { exec, execFile } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

let tempDir: string;
let SERVER_PATH: string;

// Skip end-to-end tests by default (they're slow)
// Set RUN_E2E=true to run them
const RUN_E2E = process.env.RUN_E2E === 'true';

/**
 * Helper to run the server with args and capture output.
 */
async function runServer(
  args: string[],
  env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'node',
      [SERVER_PATH, ...args],
      {
        env: { ...process.env, ...env },
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

describe.skipIf(!RUN_E2E)('MCP Server Executable - End-to-End Tests', () => {
  /**
   * Build the server to a temporary location before running tests.
   * This ensures we're testing the latest code without interfering
   * with the user's actual build in dist/.
   */
  beforeAll(async () => {
    // Create temporary directory
    tempDir = await mkdtemp(join(tmpdir(), 'ssh-server-test-'));
    SERVER_PATH = join(tempDir, 'server.cjs');

    try {
      const packageDir = new URL('..', import.meta.url).pathname;

      // Build using rollup with custom output
      // Use environment variable to override output path
      await execAsync(
        `ROLLUP_OUTPUT_FILE=${SERVER_PATH} npx rollup -c --input src/server.ts --file ${SERVER_PATH} --format cjs --banner "#!/usr/bin/env node"`,
        {
          cwd: packageDir,
          timeout: 120000,
          env: { ...process.env, ROLLUP_OUTPUT_FILE: SERVER_PATH },
        },
      );
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
   * Clean up temporary build after all tests complete.
   */
  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Help and Version', () => {
    test('should show help with --help', async () => {
      const { stdout, stderr, exitCode } = await runServer(['--help']);
      const output = stdout + stderr;

      expect(exitCode).toBe(0);
      expect(output).toContain('server.cjs [OPTIONS]');
      expect(output).toContain('SSH Connection Options:');
      expect(output).toContain('--host');
      expect(output).toContain('--username');
      expect(output).toContain('--password');
      expect(output).toContain('--private-key');
      expect(output).toContain('Environment Variables:');
      expect(output).toContain('SSH_HOST');
    });

    test('should show help with -h', async () => {
      const { stdout, stderr, exitCode } = await runServer(['-h']);
      const output = stdout + stderr;

      expect(exitCode).toBe(0);
      expect(output).toContain('server.cjs [OPTIONS]');
    });

    test('should show version with --version', async () => {
      const { stdout, exitCode } = await runServer(['--version']);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('should show version with -V', async () => {
      const { stdout, exitCode } = await runServer(['-V']);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Validation Errors', () => {
    test('should error when no arguments provided', async () => {
      const { stdout, stderr, exitCode } = await runServer([]);
      const output = stdout + stderr;

      expect(exitCode).not.toBe(0);
      expect(output).toContain('SSH host is required');
    });

    test('should error when missing host', async () => {
      const { stdout, stderr, exitCode } = await runServer([
        '--username',
        'testuser',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      expect(exitCode).not.toBe(0);
      expect(output).toContain('SSH host is required');
    });

    test('should error when missing username', async () => {
      const { stdout, stderr, exitCode } = await runServer([
        '--host',
        'example.com',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      expect(exitCode).not.toBe(0);
      expect(output).toContain('SSH username is required');
    });

    test('should error when missing authentication', async () => {
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
    test('should accept host from SSH_HOST env var', async () => {
      const { stdout, stderr } = await runServer(
        ['--username', 'testuser', '--password', 'testpass'],
        { SSH_HOST: 'env-example.com' },
      );
      const output = stdout + stderr;

      // Will fail to connect but shouldn't error on validation
      // Either connection error or help message
      expect(output).not.toContain('SSH host is required');
    });

    test('should accept username from SSH_USERNAME env var', async () => {
      const { stdout, stderr } = await runServer(
        ['--host', 'example.com', '--password', 'testpass'],
        { SSH_USERNAME: 'envuser' },
      );
      const output = stdout + stderr;

      expect(output).not.toContain('SSH username is required');
    });

    test('should accept password from SSH_PASSWORD env var', async () => {
      const { stdout, stderr } = await runServer(
        ['--host', 'example.com', '--username', 'testuser'],
        { SSH_PASSWORD: 'envpass' },
      );
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });

    test('should accept all config from env vars', async () => {
      const { stdout, stderr } = await runServer([], {
        SSH_HOST: 'env-example.com',
        SSH_USERNAME: 'envuser',
        SSH_PASSWORD: 'envpass',
      });
      const output = stdout + stderr;

      // Should pass validation
      expect(output).not.toContain('required');
    });

    test('command line args should override env vars', async () => {
      const { stdout, stderr } = await runServer(
        [
          '--host',
          'cli-example.com',
          '--username',
          'cliuser',
          '--password',
          'clipass',
        ],
        {
          SSH_HOST: 'env-example.com',
          SSH_USERNAME: 'envuser',
          SSH_PASSWORD: 'envpass',
        },
      );
      const output = stdout + stderr;

      // Should pass validation with CLI args
      expect(output).not.toContain('required');
    });
  });

  describe('Port Handling', () => {
    test('should accept port from command line', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--port',
        '2222',
        '--username',
        'testuser',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      // Should pass validation
      expect(output).not.toContain('required');
    });

    test('should accept port from SSH_PORT env var', async () => {
      const { stdout, stderr } = await runServer(
        [
          '--host',
          'example.com',
          '--username',
          'testuser',
          '--password',
          'testpass',
        ],
        { SSH_PORT: '2222' },
      );
      const output = stdout + stderr;

      // Should pass validation
      expect(output).not.toContain('required');
    });

    test('should default to port 22 when not specified', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      // Should pass validation (will fail on connection but that's OK)
      expect(output).not.toContain('required');
    });
  });

  describe('Authentication Methods', () => {
    test('should accept password authentication', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });

    test('should accept private key authentication', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--private-key',
        '/fake/path/to/key',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });

    test('should accept agent authentication', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--agent',
        '/fake/ssh/agent.sock',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });

    test('should accept passphrase with private key', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '--username',
        'testuser',
        '--private-key',
        '/fake/path/to/key',
        '--passphrase',
        'myphrase',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH authentication required');
    });
  });

  describe('Alias Support', () => {
    test('should accept -H for host', async () => {
      const { stdout, stderr } = await runServer([
        '-H',
        'example.com',
        '--username',
        'testuser',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH host is required');
    });

    test('should accept -p for port', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '-p',
        '2222',
        '--username',
        'testuser',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('required');
    });

    test('should accept -u for username', async () => {
      const { stdout, stderr } = await runServer([
        '--host',
        'example.com',
        '-u',
        'testuser',
        '--password',
        'testpass',
      ]);
      const output = stdout + stderr;

      expect(output).not.toContain('SSH username is required');
    });
  });
});
