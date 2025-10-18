#!/usr/bin/env node

/**
 * Post-build script to:
 * 1. Make the server executable
 * 2. Create a package.json in dist/ to mark it as CommonJS
 */

import { chmodSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const serverPath = join(distDir, 'server');
const distPackageJson = join(distDir, 'package.json');

// Make server executable
chmodSync(serverPath, 0o755);

// Create package.json in dist to mark files without extension as CommonJS
// This overrides the parent package.json's "type": "module"
writeFileSync(
  distPackageJson,
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);

console.log('✓ Made dist/server executable');
console.log('✓ Created dist/package.json (type: commonjs)');
