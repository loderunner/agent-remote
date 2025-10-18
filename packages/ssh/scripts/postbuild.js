#!/usr/bin/env node

/**
 * Post-build script to create a symlink for the server executable
 * without the .cjs extension, making it look like a regular executable.
 */

import { chmodSync, existsSync, symlinkSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const serverCjs = join(distDir, 'server.cjs');
const serverLink = join(distDir, 'server');

// Remove existing symlink if it exists
if (existsSync(serverLink)) {
  unlinkSync(serverLink);
}

// Create symlink: dist/server -> dist/server.cjs
symlinkSync('server.cjs', serverLink);

// Make server.cjs executable
chmodSync(serverCjs, 0o755);

console.log('✓ Created symlink: dist/server -> dist/server.cjs');
