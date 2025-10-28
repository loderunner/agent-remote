#!/usr/bin/env node

/**
 * Post-processes CHANGELOG.md files to remove conventional commit scopes
 * from changelog entries.
 * 
 * Transforms entries like:
 *   * **docker:** docker remote tools (#20)
 * Into:
 *   * docker remote tools (#20)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Remove scope prefixes from a changelog line
 * Pattern matches: * **scope:** rest of line
 */
function removeScopeFromLine(content) {
  // Match changelog bullet points with bold scope prefix
  // e.g., "* **docker:** docker remote tools" becomes "* docker remote tools"
  // Pattern explanation:
  // - ^(\s*\*) - line start with optional whitespace and asterisk (bullet)
  // - \s+ - one or more spaces
  // - \*\* - opening bold markers
  // - [^:*]+ - scope name (chars that aren't colon or asterisk)
  // - :\*\* - colon inside the bold, then closing bold markers
  // - \s+ - one or more spaces after
  return content.replace(/^(\s*\*)\s+\*\*[^:*]+:\*\*\s+/gm, '$1 ');
}

/**
 * Find all CHANGELOG.md files recursively
 */
function findChangelogFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        findChangelogFiles(fullPath, files);
      }
    } else if (entry.name === 'CHANGELOG.md') {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Process a single changelog file
 */
function processChangelogFile(filePath) {
  console.log(`Processing ${filePath}...`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const processed = removeScopeFromLine(content);
  
  if (content !== processed) {
    fs.writeFileSync(filePath, processed, 'utf8');
    console.log(`  ✓ Removed scopes from ${filePath}`);
    return true;
  } else {
    console.log(`  - No scopes found in ${filePath}`);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  const searchPath = process.argv[2] || process.cwd();
  
  console.log(`Searching for CHANGELOG.md files in: ${searchPath}\n`);
  
  const files = fs.statSync(searchPath).isDirectory()
    ? findChangelogFiles(searchPath)
    : [searchPath];
  
  if (files.length === 0) {
    console.log('No changelog files found.');
    return;
  }
  
  console.log(`Found ${files.length} changelog file(s)\n`);
  
  let modifiedCount = 0;
  for (const file of files) {
    if (processChangelogFile(file)) {
      modifiedCount++;
    }
  }
  
  console.log(`\nProcessed ${files.length} file(s), modified ${modifiedCount} file(s)`);
}

main();
