#!/usr/bin/env node

/**
 * Post-processes CHANGELOG.md files to:
 * 1. Filter entries by scope (keep only entries matching the package name)
 * 2. Remove scope prefixes from remaining entries
 * 
 * For example, in packages/ssh/CHANGELOG.md:
 * - Keep: * **ssh:** only run specified tsdown build
 * - Remove: * **docker:** docker remote tools
 * - Then transform: * **ssh:** ... -> * ...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Extract scope from a changelog line
 * Returns the scope name or null if no scope found
 */
function extractScope(line) {
  const match = line.match(/^\s*\*\s+\*\*([^:*]+):\*\*\s+/);
  return match ? match[1] : null;
}

/**
 * Extract package name from changelog path
 * e.g., "packages/ssh/CHANGELOG.md" -> "ssh"
 * e.g., "/some/path/docker/CHANGELOG.md" -> "docker"
 */
function extractPackageName(changelogPath) {
  const parts = changelogPath.split(path.sep);
  
  // First try to find it after "packages" directory
  const packagesIndex = parts.indexOf('packages');
  if (packagesIndex >= 0 && packagesIndex < parts.length - 1) {
    return parts[packagesIndex + 1];
  }
  
  // Otherwise, use the parent directory of CHANGELOG.md
  const changelogIndex = parts.findIndex(p => p === 'CHANGELOG.md');
  if (changelogIndex > 0) {
    return parts[changelogIndex - 1];
  }
  
  return null;
}

/**
 * Check if a scope matches the package name
 * Handles multiple scopes separated by comma
 */
function scopeMatchesPackage(scope, packageName) {
  if (!scope || !packageName) {
    return false;
  }
  
  // Handle multiple scopes like "ssh,docker"
  const scopes = scope.split(',').map(s => s.trim());
  return scopes.includes(packageName);
}

/**
 * Clean up empty sections (e.g., "### Features" with no entries)
 */
function cleanEmptySections(content) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this is a section header (### Something)
    if (line.match(/^###\s+/)) {
      // Look ahead to see if there are any entries in this section
      let j = i + 1;
      let hasEntries = false;
      
      // Skip empty lines after the header
      while (j < lines.length && lines[j].trim() === '') {
        j++;
      }
      
      // Check if next non-empty line is an entry (starts with *)
      if (j < lines.length && lines[j].match(/^\s*\*/)) {
        hasEntries = true;
      }
      
      if (hasEntries) {
        // Keep the section header
        result.push(line);
      } else {
        // Skip the section header and any empty lines after it
        i = j - 1;
      }
    } else {
      result.push(line);
    }
    
    i++;
  }
  
  // Remove any trailing empty lines before the next section
  let cleaned = result.join('\n');
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n'); // Reduce multiple empty lines to double
  
  return cleaned;
}

/**
 * Filter changelog entries by scope and remove scope prefixes
 */
function processChangelogContent(content, packageName) {
  if (!packageName) {
    // If we can't determine package name, just remove scopes without filtering
    return content.replace(/^(\s*\*)\s+\*\*[^:*]+:\*\*\s+/gm, '$1 ');
  }
  
  const lines = content.split('\n');
  const result = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const scope = extractScope(line);
    
    if (scope !== null) {
      // This is a changelog entry with a scope
      if (scopeMatchesPackage(scope, packageName)) {
        // Keep this entry and remove the scope prefix
        const cleanedLine = line.replace(/^(\s*\*)\s+\*\*[^:*]+:\*\*\s+/, '$1 ');
        result.push(cleanedLine);
      }
      // else: skip this line (different scope)
    } else {
      // Not a scoped entry, keep as-is
      result.push(line);
    }
    
    i++;
  }
  
  const filtered = result.join('\n');
  return cleanEmptySections(filtered);
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
  const packageName = extractPackageName(filePath);
  console.log(`Processing ${filePath}${packageName ? ` (package: ${packageName})` : ''}...`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const processed = processChangelogContent(content, packageName);
  
  if (content !== processed) {
    fs.writeFileSync(filePath, processed, 'utf8');
    
    // Count changes
    const originalLines = content.split('\n').filter(l => extractScope(l) !== null);
    const processedLines = processed.split('\n').filter(l => extractScope(l) !== null);
    const removedCount = originalLines.length - processedLines.length;
    
    if (removedCount > 0) {
      console.log(`  ✓ Filtered ${removedCount} entry/entries with non-matching scope(s)`);
    }
    console.log(`  ✓ Removed scope prefixes from ${filePath}`);
    return true;
  } else {
    console.log(`  - No changes needed in ${filePath}`);
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
