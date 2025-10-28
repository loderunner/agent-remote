# GitHub Actions Scripts

This directory contains scripts used by GitHub Actions workflows.

## remove-changelog-scopes.js

Post-processes `CHANGELOG.md` files to remove conventional commit scopes from changelog entries.

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

Transforms changelog entries by removing scope prefixes:

**Before:**
```markdown
* **docker:** docker remote tools ([#20](https://github.com/...))
* **ssh:** only run specified tsdown build in e2e tests ([#22](https://github.com/...))
```

**After:**
```markdown
* docker remote tools ([#20](https://github.com/...))
* only run specified tsdown build in e2e tests ([#22](https://github.com/...))
```

### Integration

This script is automatically run by the `process-release-changelogs.yml` workflow whenever release-please creates or updates a release PR.
