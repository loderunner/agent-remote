# tsdown Parallel Build Investigation Report

## Problem Summary

When using tsdown programmatically via the `build()` function, all build targets from the config file are executed in parallel, even when passing a single target configuration. This differs from CLI behavior where only the specified config is built.

## Reproduction

### CLI Behavior (Expected)
```bash
cd packages/ssh
pnpm exec tsdown -c tsdown.debug.config.ts
```

**Output:** Single build execution
- 1x `build:prepare` hook
- 1x `build:before` hook
- 1x `buildStart` plugin hook
- 1x `buildEnd` plugin hook
- 1x `build:done` hook
- Build time: ~48ms

### Programmatic Behavior (Buggy)
```typescript
import { build } from 'tsdown';
import { serverTarget } from './tsdown.debug.config';

await build(serverTarget);
```

**Output:** Quadruple parallel builds
- 4x `build:prepare` hooks
- 4x `build:before` hooks
- 4x `buildStart` plugin hooks
- 4x `buildEnd` plugin hooks
- 4x `build:done` hooks
- Build time: ~111-116ms

## Root Cause Analysis

### Code Flow Investigation

By examining the tsdown source code at `/workspace/node_modules/.pnpm/tsdown@0.15.10_typescript@5.9.3/node_modules/tsdown/dist/src-C8lha2rV.mjs`, the issue becomes clear:

#### 1. The `build()` Function (line 1320)
```javascript
async function build$1(userOptions = {}) {
    globalLogger.level = userOptions.logLevel || (userOptions.silent ? "error" : "info");
    const { configs, files: configFiles } = await resolveOptions(userOptions);
    // ...
    const rebuilds = await Promise.all(configs.map(options => buildSingle(options, clean)));
    // ...
}
```

The function:
1. Accepts a single `userOptions` parameter
2. Calls `resolveOptions(userOptions)` which returns an array of `configs`
3. Builds ALL configs in parallel using `Promise.all()`

#### 2. The `resolveOptions()` Function (line 618)
```javascript
async function resolveOptions(options) {
    debug$4("options %O", options);
    const { configs: rootConfigs, file } = await loadConfigFile(options);
    // ...
    return { configs, files };
}
```

This function calls `loadConfigFile()` which loads the config file from disk.

#### 3. The `loadConfigFile()` Function (line 531)
```javascript
async function loadConfigFile(options, workspace) {
    let cwd = options.cwd || process.cwd();
    let overrideConfig = false;
    let { config: filePath } = options;
    if (filePath === false) return { configs: [{}] };  // ← KEY LINE
    // ... loads tsdown.config.ts from disk
}
```

**The Problem:**
- Even when you pass a configuration object to `build()`, it still searches for and loads `tsdown.config.ts` from the current directory
- In this case, `tsdown.config.ts` exports 4 targets: `esmTarget`, `cjsTarget`, `serverTarget`, and `typeDeclarationsTarget`
- All 4 targets are built in parallel, regardless of which single target you passed to `build()`

**The Key:** Line 535 shows that if `options.config === false`, the function returns early without loading the config file.

## Solution

To prevent loading the config file when calling `build()` programmatically, add `config: false` to the options:

### Fixed Code
```typescript
import { build } from 'tsdown';
import { serverTarget } from './tsdown.debug.config';

await build({ 
    ...serverTarget, 
    config: false  // ← Prevents loading tsdown.config.ts
});
```

### Verification
Running the fixed version shows:
- 1x `build:prepare` hook (down from 4x)
- 1x `build:before` hook (down from 4x)
- 1x `buildStart` plugin hook (down from 4x)
- 1x `buildEnd` plugin hook (down from 4x)
- 1x `build:done` hook (down from 4x)
- Build time: ~68ms (down from ~111-116ms)

## Alternative Solutions

### Option 1: Use a Temporary Config File
Create a dedicated config file with only the target you want to build:

```typescript
// tsdown.single.config.ts
import { defineConfig } from 'tsdown';
import { serverTarget } from './tsdown.config';

export default defineConfig([serverTarget]);
```

Then:
```typescript
await build({ config: './tsdown.single.config.ts' });
```

**Pros:** Clean separation
**Cons:** Extra file maintenance

### Option 2: Use the `buildSingle()` Function
The internal `buildSingle()` function bypasses config file loading:

```typescript
import { buildSingle } from 'tsdown';
// Note: This is marked as @internal and may change in future versions
```

**Pros:** Direct control
**Cons:** Uses internal API, not recommended for production

### Option 3: Set CWD to Empty Directory
Change the working directory to a location without a config file:

```typescript
await build({ ...serverTarget, cwd: '/tmp' });
```

**Pros:** No config pollution
**Cons:** Fragile, may break path resolution

## Recommendation

**Use `config: false`** when calling `build()` programmatically with an inline configuration. This is:
- The official way (based on the code check)
- Clean and explicit
- No performance overhead
- No file system pollution

## Implementation Example

For the `packages/ssh` package, update `tsdown-debug-build.ts`:

```typescript
import { build } from 'tsdown';
import { serverTarget } from './tsdown.debug.config';

console.log(`${new Date().toISOString()} - Building server`);
await build({ ...serverTarget, config: false });
console.log(`${new Date().toISOString()} - Server built`);
```

## Performance Impact

- **Before:** 4 parallel builds, ~111-116ms
- **After:** 1 sequential build, ~68ms
- **Improvement:** ~40% faster, 75% reduction in redundant work
