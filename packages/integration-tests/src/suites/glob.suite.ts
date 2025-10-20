import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RemoteInstance, RemoteProvider, TestEnvironment } from '../provider';

/**
 * Test suite for glob tool.
 * Tests file pattern matching and glob operations.
 *
 * @param provider - Remote provider implementation to test
 */
export function globSuite(provider: RemoteProvider) {
  describe(`glob tool [${provider.name}]`, () => {
    let remote: RemoteInstance;
    let env: TestEnvironment;

    beforeAll(async () => {
      remote = await provider.connect();
      env = provider.getTestEnvironment();
    });

    afterAll(async () => {
      await provider.disconnect(remote);
    });

    it('should find files matching simple pattern', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: '*.txt',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBeGreaterThan(0);
      expect(result.structuredContent?.matches.length).toBe(
        result.structuredContent?.count,
      );

      for (const match of result.structuredContent!.matches) {
        expect(match).toMatch(/\.txt$/);
      }
    });

    it('should find files with globstar pattern', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: '**/*.md',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBeGreaterThan(0);

      for (const match of result.structuredContent!.matches) {
        expect(match).toMatch(/\.md$/);
      }
    });

    it('should find JavaScript files', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: '**/*.js',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBeGreaterThan(0);

      for (const match of result.structuredContent!.matches) {
        expect(match).toMatch(/\.js$/);
      }
    });

    it('should find Python files', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: '**/*.py',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBeGreaterThan(0);

      for (const match of result.structuredContent!.matches) {
        expect(match).toMatch(/\.py$/);
      }
    });

    it('should handle pattern with multiple extensions', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: '**/*.{js,py}',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBeGreaterThan(0);

      for (const match of result.structuredContent!.matches) {
        expect(match).toMatch(/\.(js|py)$/);
      }
    });

    it('should find files in specific subdirectory', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: 'code/*',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBeGreaterThan(0);

      for (const match of result.structuredContent!.matches) {
        expect(match).toContain('/code/');
      }
    });

    it('should find deeply nested files', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: 'nested/**/*',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBeGreaterThan(0);

      const hasDeepFile = result.structuredContent!.matches.some((match) =>
        match.includes('/deep/'),
      );
      expect(hasDeepFile).toBe(true);
    });

    it('should return empty array when no matches found', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: '**/*.nonexistent-extension',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBe(0);
      expect(result.structuredContent?.matches).toEqual([]);
    });

    it('should handle pattern matching all files', async () => {
      const result = await remote.glob.handler({
        base_path: env.fixturesPath,
        pattern: '**/*',
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.count).toBeGreaterThan(5);
    });
  });
}
