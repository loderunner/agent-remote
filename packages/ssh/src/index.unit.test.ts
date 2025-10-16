/* eslint-disable @typescript-eslint/unbound-method */
import { Client, ClientSFTPCallback, SFTPWrapper } from 'ssh2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

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

const mockBashTool = mockDeep<BashTool>();
vi.mocked(BashTool).mockImplementation(() => mockBashTool);

const mockFileTool = mockDeep<FileTool>();
vi.mocked(FileTool).mockImplementation(() => mockFileTool);

const mockGlobTool = mockDeep<GlobTool>();
vi.mocked(GlobTool).mockImplementation(() => mockGlobTool);

const mockGrepTool = mockDeep<GrepTool>();
vi.mocked(GrepTool).mockImplementation(() => mockGrepTool);

const mockClient = mockDeep<Client>();
vi.mocked(Client).mockImplementation(() => mockClient);

const mockSftp = mockDeep<SFTPWrapper>();

describe('connect function', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockClient.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, () => void];
      if (event === 'ready') {
        callback();
      }
      return mockClient;
    });
    mockClient.sftp.mockImplementation((callback: ClientSFTPCallback) => {
      callback(undefined, mockSftp);
      return mockClient;
    });

    vi.mocked(Client).mockImplementation(() => mockClient);
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
      mockClient.on.mockImplementation((...args: unknown[]) => {
        const [event, callback] = args as [string, (error: Error) => void];
        if (event === 'error') {
          callback(new Error('Connection failed'));
        }
        return mockClient;
      });

      await expect(
        connect({ host: 'localhost', username: 'test' }),
      ).rejects.toThrow('Connection failed');
    });

    it('should handle SFTP connection errors', async () => {
      mockClient.sftp.mockImplementation((callback: ClientSFTPCallback) => {
        callback(new Error('SFTP failed'), null as unknown as SFTPWrapper);
        return mockClient;
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
      mockBashTool.execute.mockResolvedValue({
        output: 'command output',
        exitCode: 0,
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const bashTool = tools[0];

      const result = await bashTool.handler({ command: 'echo hello' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'command output' }],
        structuredContent: { output: 'command output', exitCode: 0 },
      });
      expect(mockBashTool.execute).toHaveBeenCalledWith({
        command: 'echo hello',
      });
    });

    it('should handle bash command errors', async () => {
      mockBashTool.execute.mockRejectedValue(new Error('Command failed'));

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const bashTool = tools[0];

      const result = await bashTool.handler({ command: 'bad command' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Failed to execute bash command: Command failed',
          },
        ],
        isError: true,
      });
      expect(mockBashTool.execute).toHaveBeenCalledWith({
        command: 'bad command',
      });
    });
  });

  describe('bash-output tool handler', () => {
    it('should retrieve bash output successfully', async () => {
      mockBashTool.getOutput.mockResolvedValue({
        output: 'background output',
        status: 'running',
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const bashOutputTool = tools[1];

      const result = await bashOutputTool.handler({ shell_id: 'abc123' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'background output' }],
        structuredContent: { output: 'background output', status: 'running' },
      });
      expect(mockBashTool.getOutput).toHaveBeenCalledWith({
        shell_id: 'abc123',
      });
    });

    it('should handle bash output retrieval errors', async () => {
      mockBashTool.getOutput.mockRejectedValue(new Error('Shell not found'));

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const bashOutputTool = tools[1];

      const result = await bashOutputTool.handler({ shell_id: 'invalid' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Failed to retrieve bash output: Shell not found',
          },
        ],
        isError: true,
      });
      expect(mockBashTool.getOutput).toHaveBeenCalledWith({
        shell_id: 'invalid',
      });
    });
  });

  describe('kill-bash tool handler', () => {
    it('should kill shell successfully', async () => {
      mockBashTool.killShell.mockResolvedValue({ killed: true });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const killBashTool = tools[2];

      const result = await killBashTool.handler({ shell_id: 'abc123' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Shell abc123 killed' }],
        structuredContent: { killed: true },
      });
      expect(mockBashTool.killShell).toHaveBeenCalledWith({
        shell_id: 'abc123',
      });
    });

    it('should handle shell not found when killing', async () => {
      mockBashTool.killShell.mockResolvedValue({ killed: false });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const killBashTool = tools[2];

      const result = await killBashTool.handler({ shell_id: 'invalid' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Shell invalid not found' }],
        structuredContent: { killed: false },
      });
      expect(mockBashTool.killShell).toHaveBeenCalledWith({
        shell_id: 'invalid',
      });
    });

    it('should handle kill shell errors', async () => {
      mockBashTool.killShell.mockRejectedValue(new Error('Failed to signal'));

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const killBashTool = tools[2];

      const result = await killBashTool.handler({ shell_id: 'abc123' });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Failed to kill bash shell: Failed to signal' },
        ],
        isError: true,
      });
      expect(mockBashTool.killShell).toHaveBeenCalledWith({
        shell_id: 'abc123',
      });
    });
  });

  describe('grep tool handler', () => {
    it('should grep in content mode successfully', async () => {
      mockGrepTool.grep.mockResolvedValue({
        mode: 'content',
        content: 'line1\nline2',
        numLines: 2,
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const grepTool = tools[3];

      const result = await grepTool.handler({
        pattern: 'ERROR',
        path: '/var/log',
        output_mode: 'content',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'line1\nline2' }],
        structuredContent: {
          mode: 'content',
          content: 'line1\nline2',
          numLines: 2,
        },
      });
      expect(mockGrepTool.grep).toHaveBeenCalledWith({
        pattern: 'ERROR',
        path: '/var/log',
        output_mode: 'content',
      });
    });

    it('should grep in files_with_matches mode successfully', async () => {
      mockGrepTool.grep.mockResolvedValue({
        mode: 'files_with_matches',
        numFiles: 3,
        filenames: ['file1.txt', 'file2.txt', 'file3.txt'],
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const grepTool = tools[3];

      const result = await grepTool.handler({
        pattern: 'TODO',
        path: '/src',
        output_mode: 'files_with_matches',
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Found 3 files\nfile1.txt\nfile2.txt\nfile3.txt',
          },
        ],
        structuredContent: {
          mode: 'files_with_matches',
          numFiles: 3,
          filenames: ['file1.txt', 'file2.txt', 'file3.txt'],
        },
      });
      expect(mockGrepTool.grep).toHaveBeenCalledWith({
        pattern: 'TODO',
        path: '/src',
        output_mode: 'files_with_matches',
      });
    });

    it('should grep in count mode successfully', async () => {
      mockGrepTool.grep.mockResolvedValue({
        mode: 'count',
        numMatches: 42,
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const grepTool = tools[3];

      const result = await grepTool.handler({
        pattern: 'ERROR',
        path: '/var/log',
        output_mode: 'count',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Found 42 matches' }],
        structuredContent: { mode: 'count', numMatches: 42 },
      });
      expect(mockGrepTool.grep).toHaveBeenCalledWith({
        pattern: 'ERROR',
        path: '/var/log',
        output_mode: 'count',
      });
    });

    it('should handle grep errors', async () => {
      mockGrepTool.grep.mockRejectedValue(new Error('Pattern invalid'));

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const grepTool = tools[3];

      const result = await grepTool.handler({
        pattern: '[',
        path: '/src',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Failed to grep: Pattern invalid' }],
        isError: true,
      });
      expect(mockGrepTool.grep).toHaveBeenCalledWith({
        pattern: '[',
        path: '/src',
      });
    });
  });

  describe('read tool handler', () => {
    it('should read file successfully', async () => {
      mockFileTool.read.mockResolvedValue({
        content: 'line 1\nline 2\nline 3',
        numLines: 3,
        startLine: 1,
        totalLines: 3,
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const readTool = tools[4];

      const result = await readTool.handler({ file_path: '/home/test.txt' });

      expect(result).toEqual({
        content: [{ type: 'text', text: '1\tline 1\n2\tline 2\n3\tline 3' }],
        structuredContent: {
          content: 'line 1\nline 2\nline 3',
          numLines: 3,
          startLine: 1,
          totalLines: 3,
        },
      });
      expect(mockFileTool.read).toHaveBeenCalledWith({
        file_path: '/home/test.txt',
      });
    });

    it('should format line numbers with proper padding', async () => {
      mockFileTool.read.mockResolvedValue({
        content: 'line 1\nline 2',
        numLines: 2,
        startLine: 98,
        totalLines: 100,
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const readTool = tools[4];

      const result = await readTool.handler({
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
      expect(mockFileTool.read).toHaveBeenCalledWith({
        file_path: '/home/test.txt',
        offset: 98,
        limit: 2,
      });
    });

    it('should handle read errors', async () => {
      mockFileTool.read.mockRejectedValue(new Error('File not found'));

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const readTool = tools[4];

      const result = await readTool.handler({ file_path: '/invalid.txt' });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Failed to read file: File not found' },
        ],
        isError: true,
      });
      expect(mockFileTool.read).toHaveBeenCalledWith({
        file_path: '/invalid.txt',
      });
    });
  });

  describe('write tool handler', () => {
    it('should write file successfully', async () => {
      mockFileTool.write.mockResolvedValue({
        content: 'new content',
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const writeTool = tools[5];

      const result = await writeTool.handler({
        file_path: '/home/test.txt',
        content: 'new content',
      });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Successfully wrote to /home/test.txt' },
        ],
        structuredContent: { content: 'new content' },
      });
      expect(mockFileTool.write).toHaveBeenCalledWith({
        file_path: '/home/test.txt',
        content: 'new content',
      });
    });

    it('should handle write errors', async () => {
      mockFileTool.write.mockRejectedValue(new Error('Permission denied'));

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const writeTool = tools[5];

      const result = await writeTool.handler({
        file_path: '/root/protected.txt',
        content: 'data',
      });

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Failed to write file: Permission denied' },
        ],
        isError: true,
      });
      expect(mockFileTool.write).toHaveBeenCalledWith({
        file_path: '/root/protected.txt',
        content: 'data',
      });
    });
  });

  describe('edit tool handler', () => {
    it('should edit file successfully with diff', async () => {
      mockFileTool.edit.mockResolvedValue({
        replacements: 1,
        diff: {
          oldFileName: '/home/test.txt',
          newFileName: '/home/test.txt',
          oldHeader: '',
          newHeader: '',
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

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const editTool = tools[6];

      const result = await editTool.handler({
        file_path: '/home/test.txt',
        old_string: 'old line',
        new_string: 'new line',
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain(
        'Made 1 replacement in /home/test.txt',
      );
      expect(result.content[0].text).toContain('-old line');
      expect(result.content[0].text).toContain('+new line');
      expect(mockFileTool.edit).toHaveBeenCalledWith({
        file_path: '/home/test.txt',
        old_string: 'old line',
        new_string: 'new line',
      });
    });

    it('should handle multiple replacements', async () => {
      mockFileTool.edit.mockResolvedValue({
        replacements: 3,
        diff: {
          oldFileName: '/home/test.txt',
          newFileName: '/home/test.txt',
          oldHeader: '',
          newHeader: '',
          hunks: [],
        },
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const editTool = tools[6];

      const result = await editTool.handler({
        file_path: '/home/test.txt',
        old_string: 'foo',
        new_string: 'bar',
        replace_all: true,
      });

      expect(result.content[0].text).toContain(
        'Made 3 replacements in /home/test.txt',
      );
      expect(mockFileTool.edit).toHaveBeenCalledWith({
        file_path: '/home/test.txt',
        old_string: 'foo',
        new_string: 'bar',
        replace_all: true,
      });
    });

    it('should handle no replacements', async () => {
      mockFileTool.edit.mockResolvedValue({
        replacements: 0,
        diff: {
          oldFileName: '/home/test.txt',
          newFileName: '/home/test.txt',
          oldHeader: '',
          newHeader: '',
          hunks: [],
        },
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const editTool = tools[6];

      const result = await editTool.handler({
        file_path: '/home/test.txt',
        old_string: 'not found',
        new_string: 'replacement',
      });

      expect(result.content[0].text).toBe(
        'Made 0 replacements in /home/test.txt',
      );
      expect(mockFileTool.edit).toHaveBeenCalledWith({
        file_path: '/home/test.txt',
        old_string: 'not found',
        new_string: 'replacement',
      });
    });

    it('should handle edit errors', async () => {
      mockFileTool.edit.mockRejectedValue(new Error('File locked'));

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const editTool = tools[6];

      const result = await editTool.handler({
        file_path: '/home/test.txt',
        old_string: 'old',
        new_string: 'new',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Failed to edit file: File locked' }],
        isError: true,
      });
      expect(mockFileTool.edit).toHaveBeenCalledWith({
        file_path: '/home/test.txt',
        old_string: 'old',
        new_string: 'new',
      });
    });
  });

  describe('glob tool handler', () => {
    it('should glob files successfully', async () => {
      mockGlobTool.glob.mockResolvedValue({
        matches: ['file1.ts', 'file2.ts', 'dir/file3.ts'],
        count: 3,
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const globTool = tools[7];

      const result = await globTool.handler({
        base_path: '/home/project',
        pattern: '**/*.ts',
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Found 3 matches\nfile1.ts\nfile2.ts\ndir/file3.ts',
          },
        ],
        structuredContent: {
          matches: ['file1.ts', 'file2.ts', 'dir/file3.ts'],
          count: 3,
        },
      });
      expect(mockGlobTool.glob).toHaveBeenCalledWith({
        base_path: '/home/project',
        pattern: '**/*.ts',
      });
    });

    it('should handle single match correctly', async () => {
      mockGlobTool.glob.mockResolvedValue({
        matches: ['single.txt'],
        count: 1,
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const globTool = tools[7];

      const result = await globTool.handler({
        base_path: '/home',
        pattern: 'single.txt',
      });

      expect(result.content[0].text).toBe('Found 1 match\nsingle.txt');
      expect(mockGlobTool.glob).toHaveBeenCalledWith({
        base_path: '/home',
        pattern: 'single.txt',
      });
    });

    it('should handle no matches', async () => {
      mockGlobTool.glob.mockResolvedValue({
        matches: [],
        count: 0,
      });

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const globTool = tools[7];

      const result = await globTool.handler({
        base_path: '/home',
        pattern: '*.xyz',
      });

      expect(result.content[0].text).toBe('Found 0 matches\n');
      expect(mockGlobTool.glob).toHaveBeenCalledWith({
        base_path: '/home',
        pattern: '*.xyz',
      });
    });

    it('should handle glob errors', async () => {
      mockGlobTool.glob.mockRejectedValue(new Error('Invalid pattern'));

      const { tools } = await connect({ host: 'localhost', username: 'test' });
      const globTool = tools[7];

      const result = await globTool.handler({
        base_path: '/home',
        pattern: '[[[',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Failed to glob: Invalid pattern' }],
        isError: true,
      });
      expect(mockGlobTool.glob).toHaveBeenCalledWith({
        base_path: '/home',
        pattern: '[[[',
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
