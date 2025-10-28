# GitHub Actions Scripts

This directory contains scripts used by GitHub Actions workflows.

## remove-changelog-scopes.js

Post-processes `CHANGELOG.md` files to:
1. Filter entries by scope (keeping only entries that match the package name)
2. Remove scope prefixes from remaining entries
3. Clean up empty sections

### Usage

```bash
node .github/scripts/remove-changelog-scopes.js <path>
```

Where `<path>` can be:
- A directory path (will recursively find all `CHANGELOG.md` files)
- A specific `CHANGELOG.md` file path

### Example

```bash
# Process all changelogs in packages directory
node .github/scripts/remove-changelog-scopes.js packages

# Process a specific changelog
node .github/scripts/remove-changelog-scopes.js packages/core/CHANGELOG.md
```

### What it does

#### 1. Filters entries by scope

Entries are filtered based on the package name extracted from the changelog path. For `packages/ssh/CHANGELOG.md`:

**Before:**
```markdown
### Features

* **docker:** docker remote tools ([#20](https://github.com/...))
* **ssh:** only run specified tsdown build ([#22](https://github.com/...))
* **core:** update core definitions ([#23](https://github.com/...))
```

**After (in ssh package):**
```markdown
### Features

* only run specified tsdown build ([#22](https://github.com/...))
```

#### 2. Handles multi-scope entries

Entries with multiple scopes (e.g., `**ssh,docker:**`) are kept in all matching packages:

**Before:**
```markdown
* **ssh,docker:** shared feature across packages ([#30](https://github.com/...))
```

**After (in both ssh and docker packages):**
```markdown
* shared feature across packages ([#30](https://github.com/...))
```

#### 3. Cleans up empty sections

If a section has no remaining entries after filtering, the section header is removed:

**Before:**
```markdown
### Features

### Bug Fixes

* some bug fix
```

**After:**
```markdown
### Bug Fixes

* some bug fix
```

### Integration

This script is automatically run by the `process-release-changelogs.yml` workflow whenever release-please creates or updates a release PR.
