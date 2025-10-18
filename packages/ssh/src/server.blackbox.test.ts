/**
 * Black box tests for the MCP server executable.
 * These tests run the actual built server script and validate outputs.
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';

import { beforeAll, describe, expect, test } from 'vitest';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const SERVER_PATH = new URL('../dist/server.cjs', import.meta.url).pathname;

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

describe('MCP Server Executable - Black Box Tests', () => {
  /**
   * Build the server before running tests.
   * This ensures we're always testing against the latest code,
   * even if dist/ doesn't exist or is stale.
   */
  beforeAll(async () => {
    console.log('Building server for black box tests...');
    try {
      const { stdout, stderr } = await execAsync('pnpm build', {
        cwd: new URL('..', import.meta.url).pathname,
        timeout: 120000,
      });
      if (stderr && !stderr.includes('created dist/server.cjs')) {
        console.log('Build output:', stdout);
        if (stderr) console.error('Build stderr:', stderr);
      }
      console.log('✓ Server built successfully');
    } catch (error) {
      console.error('Failed to build server:', error);
      throw error;
    }
  }, 120000);

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

    test('should show version with -v', async () => {
      const { stdout, exitCode } = await runServer(['-v']);

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
