/* eslint-disable @typescript-eslint/unbound-method */
import { Client, SFTPWrapper } from 'ssh2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BashTool } from './bash';
import { FileTool } from './file';
import { GlobTool } from './glob';
import { GrepTool } from './grep';
import { connect } from './index';

// Mock all dependencies
vi.mock('ssh2');
vi.mock('./bash');
vi.mock('./file');
vi.mock('./glob');
vi.mock('./grep');

describe('connect function', () => {
  let mockClient: Client;
  let mockSftp: SFTPWrapper;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      on: vi.fn((event, callback) => {
        if (event === 'ready') {
          // Call ready immediately
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      }),
      connect: vi.fn(),
      end: vi.fn(),
      sftp: vi.fn((callback) => {
        setTimeout(() => callback(null, mockSftp), 0);
      }),
    } as unknown as Client;

    // Create mock SFTP
    mockSftp = {
      end: vi.fn(),
    } as unknown as SFTPWrapper;

    // Mock Client constructor
    (Client as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockClient,
    );
  });

  describe('connection', () => {
    it('should connect to SSH server successfully', async () => {
      const result = await connect({ host: 'localhost', username: 'test' });

      expect(Client).toHaveBeenCalledOnce();
      expect(mockClient.connect).toHaveBeenCalledOnce();
      expect(result).toHaveProperty('tools');
      expect(result).toHaveProperty('disconnect');
    });

    it('should handle connection errors', async () => {
      mockClient.on = vi.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection failed')), 0);
        }
        return mockClient;
      });

      await expect(
        connect({ host: 'localhost', username: 'test' }),
      ).rejects.toThrow('Connection failed');
    });

    it('should handle SFTP connection errors', async () => {
      mockClient.sftp = vi.fn((callback) => {
        setTimeout(() => callback(new Error('SFTP failed'), null), 0);
      });

      await expect(
        connect({ host: 'localhost', username: 'test' }),
      ).rejects.toThrow('SFTP failed');
    });

    it('should provide disconnect function', async () => {
      const result = await connect({ host: 'localhost', username: 'test' });

      result.disconnect();

      expect(mockSftp.end).toHaveBeenCalledOnce();
      expect(mockClient.end).toHaveBeenCalledOnce();
    });
  });

  describe('bash tool handler', () => {
    it('should execute bash command successfully', async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        output: 'command output',
        exitCode: 0,
      });
      (BashTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          execute: mockExecute,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const bashTool = tools.find((t) => t.name === 'bash');

      const result = await bashTool!.handler({ command: 'echo hello' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'command output' }],
        structuredContent: { output: 'command output', exitCode: 0 },
      });
      expect(mockExecute).toHaveBeenCalledWith({ command: 'echo hello' });
    });

    it('should handle bash command errors', async () => {
      const mockExecute = vi
        .fn()
        .mockRejectedValue(new Error('Command failed'));
      (BashTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          execute: mockExecute,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const bashTool = tools.find((t) => t.name === 'bash');

      const result = await bashTool!.handler({ command: 'bad command' });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Failed to execute bash command: Command failed' },
        ],
        isError: true,
      });
    });
  });

  describe('bash-output tool handler', () => {
    it('should retrieve bash output successfully', async () => {
      const mockGetOutput = vi.fn().mockResolvedValue({
        output: 'background output',
        status: 'running',
      });
      (BashTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          getOutput: mockGetOutput,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const bashOutputTool = tools.find((t) => t.name === 'bash-output');

      const result = await bashOutputTool!.handler({ shell_id: 'abc123' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'background output' }],
        structuredContent: { output: 'background output', status: 'running' },
      });
      expect(mockGetOutput).toHaveBeenCalledWith({ shell_id: 'abc123' });
    });

    it('should handle bash output retrieval errors', async () => {
      const mockGetOutput = vi
        .fn()
        .mockRejectedValue(new Error('Shell not found'));
      (BashTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          getOutput: mockGetOutput,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const bashOutputTool = tools.find((t) => t.name === 'bash-output');

      const result = await bashOutputTool!.handler({ shell_id: 'invalid' });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Failed to retrieve bash output: Shell not found' },
        ],
        isError: true,
      });
    });
  });

  describe('kill-bash tool handler', () => {
    it('should kill shell successfully', async () => {
      const mockKillShell = vi.fn().mockResolvedValue({ killed: true });
      (BashTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          killShell: mockKillShell,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const killBashTool = tools.find((t) => t.name === 'kill-bash');

      const result = await killBashTool!.handler({ shell_id: 'abc123' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Shell abc123 killed' }],
        structuredContent: { killed: true },
      });
      expect(mockKillShell).toHaveBeenCalledWith({ shell_id: 'abc123' });
    });

    it('should handle shell not found when killing', async () => {
      const mockKillShell = vi.fn().mockResolvedValue({ killed: false });
      (BashTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          killShell: mockKillShell,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const killBashTool = tools.find((t) => t.name === 'kill-bash');

      const result = await killBashTool!.handler({ shell_id: 'invalid' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Shell invalid not found' }],
        structuredContent: { killed: false },
      });
    });

    it('should handle kill shell errors', async () => {
      const mockKillShell = vi
        .fn()
        .mockRejectedValue(new Error('Failed to signal'));
      (BashTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          killShell: mockKillShell,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const killBashTool = tools.find((t) => t.name === 'kill-bash');

      const result = await killBashTool!.handler({ shell_id: 'abc123' });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Failed to kill bash shell: Failed to signal' },
        ],
        isError: true,
      });
    });
  });

  describe('grep tool handler', () => {
    it('should grep in content mode successfully', async () => {
      const mockGrep = vi.fn().mockResolvedValue({
        mode: 'content',
        content: 'line1\nline2',
        numLines: 2,
      });
      (GrepTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          grep: mockGrep,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const grepTool = tools.find((t) => t.name === 'grep');

      const result = await grepTool!.handler({
        pattern: 'ERROR',
        path: '/var/log',
        output_mode: 'content',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'line1\nline2' }],
        structuredContent: { mode: 'content', content: 'line1\nline2', numLines: 2 },
      });
    });

    it('should grep in files_with_matches mode successfully', async () => {
      const mockGrep = vi.fn().mockResolvedValue({
        mode: 'files_with_matches',
        numFiles: 3,
        filenames: ['file1.txt', 'file2.txt', 'file3.txt'],
      });
      (GrepTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          grep: mockGrep,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const grepTool = tools.find((t) => t.name === 'grep');

      const result = await grepTool!.handler({
        pattern: 'TODO',
        path: '/src',
        output_mode: 'files_with_matches',
      });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Found 3 files\nfile1.txt\nfile2.txt\nfile3.txt' },
        ],
        structuredContent: {
          mode: 'files_with_matches',
          numFiles: 3,
          filenames: ['file1.txt', 'file2.txt', 'file3.txt'],
        },
      });
    });

    it('should grep in count mode successfully', async () => {
      const mockGrep = vi.fn().mockResolvedValue({
        mode: 'count',
        numMatches: 42,
      });
      (GrepTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          grep: mockGrep,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const grepTool = tools.find((t) => t.name === 'grep');

      const result = await grepTool!.handler({
        pattern: 'ERROR',
        path: '/var/log',
        output_mode: 'count',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Found 42 matches' }],
        structuredContent: { mode: 'count', numMatches: 42 },
      });
    });

    it('should handle grep errors', async () => {
      const mockGrep = vi.fn().mockRejectedValue(new Error('Pattern invalid'));
      (GrepTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          grep: mockGrep,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const grepTool = tools.find((t) => t.name === 'grep');

      const result = await grepTool!.handler({
        pattern: '[',
        path: '/src',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Failed to grep: Pattern invalid' }],
        isError: true,
      });
    });
  });

  describe('read tool handler', () => {
    it('should read file successfully', async () => {
      const mockRead = vi.fn().mockResolvedValue({
        content: 'line 1\nline 2\nline 3',
        numLines: 3,
        startLine: 1,
        totalLines: 3,
      });
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          read: mockRead,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const readTool = tools.find((t) => t.name === 'read');

      const result = await readTool!.handler({ file_path: '/home/test.txt' });

      expect(result).toEqual({
        content: [{ type: 'text', text: '1\tline 1\n2\tline 2\n3\tline 3' }],
        structuredContent: {
          content: 'line 1\nline 2\nline 3',
          numLines: 3,
          startLine: 1,
          totalLines: 3,
        },
      });
    });

    it('should format line numbers with proper padding', async () => {
      const mockRead = vi.fn().mockResolvedValue({
        content: 'line 1\nline 2',
        numLines: 2,
        startLine: 98,
        totalLines: 100,
      });
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          read: mockRead,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const readTool = tools.find((t) => t.name === 'read');

      const result = await readTool!.handler({
        file_path: '/home/test.txt',
        offset: 98,
        limit: 2,
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: '98\tline 1\n99\tline 2' }],
        structuredContent: {
          content: 'line 1\nline 2',
          numLines: 2,
          startLine: 98,
          totalLines: 100,
        },
      });
    });

    it('should handle read errors', async () => {
      const mockRead = vi.fn().mockRejectedValue(new Error('File not found'));
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          read: mockRead,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const readTool = tools.find((t) => t.name === 'read');

      const result = await readTool!.handler({ file_path: '/invalid.txt' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Failed to read file: File not found' }],
        isError: true,
      });
    });
  });

  describe('write tool handler', () => {
    it('should write file successfully', async () => {
      const mockWrite = vi.fn().mockResolvedValue({
        content: 'new content',
      });
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          write: mockWrite,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const writeTool = tools.find((t) => t.name === 'write');

      const result = await writeTool!.handler({
        file_path: '/home/test.txt',
        content: 'new content',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Successfully wrote to /home/test.txt' }],
        structuredContent: { content: 'new content' },
      });
      expect(mockWrite).toHaveBeenCalledWith({
        file_path: '/home/test.txt',
        content: 'new content',
      });
    });

    it('should handle write errors', async () => {
      const mockWrite = vi
        .fn()
        .mockRejectedValue(new Error('Permission denied'));
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          write: mockWrite,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const writeTool = tools.find((t) => t.name === 'write');

      const result = await writeTool!.handler({
        file_path: '/root/protected.txt',
        content: 'data',
      });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Failed to write file: Permission denied' },
        ],
        isError: true,
      });
    });
  });

  describe('edit tool handler', () => {
    it('should edit file successfully with diff', async () => {
      const mockEdit = vi.fn().mockResolvedValue({
        replacements: 1,
        diff: {
          oldFileName: '/home/test.txt',
          newFileName: '/home/test.txt',
          hunks: [
            {
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
              lines: ['-old line', '+new line'],
            },
          ],
        },
      });
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          edit: mockEdit,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const editTool = tools.find((t) => t.name === 'edit');

      const result = await editTool!.handler({
        file_path: '/home/test.txt',
        old_string: 'old line',
        new_string: 'new line',
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Made 1 replacement in /home/test.txt');
      expect(result.content[0].text).toContain('-old line');
      expect(result.content[0].text).toContain('+new line');
    });

    it('should handle multiple replacements', async () => {
      const mockEdit = vi.fn().mockResolvedValue({
        replacements: 3,
        diff: {
          oldFileName: '/home/test.txt',
          newFileName: '/home/test.txt',
          hunks: [],
        },
      });
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          edit: mockEdit,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const editTool = tools.find((t) => t.name === 'edit');

      const result = await editTool!.handler({
        file_path: '/home/test.txt',
        old_string: 'foo',
        new_string: 'bar',
        replace_all: true,
      });

      expect(result.content[0].text).toContain('Made 3 replacements in /home/test.txt');
    });

    it('should handle no replacements', async () => {
      const mockEdit = vi.fn().mockResolvedValue({
        replacements: 0,
        diff: {
          oldFileName: '/home/test.txt',
          newFileName: '/home/test.txt',
          hunks: [],
        },
      });
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          edit: mockEdit,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const editTool = tools.find((t) => t.name === 'edit');

      const result = await editTool!.handler({
        file_path: '/home/test.txt',
        old_string: 'not found',
        new_string: 'replacement',
      });

      expect(result.content[0].text).toBe('Made 0 replacements in /home/test.txt');
    });

    it('should handle edit errors', async () => {
      const mockEdit = vi.fn().mockRejectedValue(new Error('File locked'));
      (FileTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          edit: mockEdit,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const editTool = tools.find((t) => t.name === 'edit');

      const result = await editTool!.handler({
        file_path: '/home/test.txt',
        old_string: 'old',
        new_string: 'new',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Failed to edit file: File locked' }],
        isError: true,
      });
    });
  });

  describe('glob tool handler', () => {
    it('should glob files successfully', async () => {
      const mockGlob = vi.fn().mockResolvedValue({
        matches: ['file1.ts', 'file2.ts', 'dir/file3.ts'],
        count: 3,
      });
      (GlobTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          glob: mockGlob,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const globTool = tools.find((t) => t.name === 'glob');

      const result = await globTool!.handler({
        base_path: '/home/project',
        pattern: '**/*.ts',
      });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Found 3 matches\nfile1.ts\nfile2.ts\ndir/file3.ts' },
        ],
        structuredContent: {
          matches: ['file1.ts', 'file2.ts', 'dir/file3.ts'],
          count: 3,
        },
      });
    });

    it('should handle single match correctly', async () => {
      const mockGlob = vi.fn().mockResolvedValue({
        matches: ['single.txt'],
        count: 1,
      });
      (GlobTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          glob: mockGlob,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const globTool = tools.find((t) => t.name === 'glob');

      const result = await globTool!.handler({
        base_path: '/home',
        pattern: 'single.txt',
      });

      expect(result.content[0].text).toBe('Found 1 match\nsingle.txt');
    });

    it('should handle no matches', async () => {
      const mockGlob = vi.fn().mockResolvedValue({
        matches: [],
        count: 0,
      });
      (GlobTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          glob: mockGlob,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const globTool = tools.find((t) => t.name === 'glob');

      const result = await globTool!.handler({
        base_path: '/home',
        pattern: '*.xyz',
      });

      expect(result.content[0].text).toBe('Found 0 matches\n');
    });

    it('should handle glob errors', async () => {
      const mockGlob = vi
        .fn()
        .mockRejectedValue(new Error('Invalid pattern'));
      (GlobTool as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          glob: mockGlob,
        }),
      );

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const globTool = tools.find((t) => t.name === 'glob');

      const result = await globTool!.handler({
        base_path: '/home',
        pattern: '[[[',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Failed to glob: Invalid pattern' }],
        isError: true,
      });
    });
  });

  describe('tool definitions', () => {
    it('should have all required tools', async () => {
      const { tools } = await connect({ host: 'localhost', username: 'test' });

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toEqual([
        'bash',
        'bash-output',
        'kill-bash',
        'grep',
        'read',
        'write',
        'edit',
        'glob',
      ]);
    });

    it('should have proper tool structure', async () => {
      const { tools } = await connect({ host: 'localhost', username: 'test' });

      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('handler');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.handler).toBe('function');
      }
    });
  });
});
