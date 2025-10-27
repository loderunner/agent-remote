# @agent-remote/core

Core types and schemas for agent-remote tools.

## Overview

This package provides TypeScript types and Zod schemas for remote tool
definitions. It uses TypeScript project references with minimal build
requirements - only generating `.d.ts` declaration files needed for type
checking.

## Features

- **Pure TypeScript types** - All input/output types with full JSDoc
  documentation
- **Zod schemas** - Runtime validation schemas for all inputs
- **Tool definitions** - Generic tool definition types for MCP integration
- **Minimal build** - Only generates declaration files for TypeScript project
  references

## Usage

```typescript
import type { BashInput, FileReadInput, GrepOutput } from '@agent-remote/core';
import { bashInputSchema, fileReadInputSchema } from '@agent-remote/core';

// Use types for type checking
const input: BashInput = {
  command: 'ls -la',
  timeout: 5000,
};

// Use schemas for validation
const result = bashInputSchema.parse(input);
```

## Building Remote Integrations

This package is designed to be used in two scenarios:

### Internal Usage (Monorepo Packages)

For packages within this monorepo (like `@agent-remote/ssh`):

**1. Add as dev dependency:**

```json
{
  "devDependencies": {
    "@agent-remote/core": "workspace:*"
  }
}
```

**2. Configure TypeScript project references:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    /* ... */
  },
  "references": [{ "path": "../core" }]
}
```

**3. Bundle core in your build configuration:**

For tsdown/rolldown:

```typescript
export const config: Options = {
  entry: 'src/index.ts',
  format: 'esm',
  noExternal: ['@agent-remote/core'], // Bundle core completely
  // ...
};
```

For other bundlers, ensure `@agent-remote/core` is not treated as external.

**Why bundle?** This keeps your package standalone with zero runtime
dependencies on internal packages, avoiding build orchestration complexity.

**Development workflow:**

- Edit core types → changes immediately visible via TypeScript
- Build your package → core gets bundled automatically at latest version
- No need to rebuild core separately

### External Usage (3rd-Party Packages)

For external packages building their own remote integrations:

**1. Install from npm:**

```bash
npm install @agent-remote/core
```

**2. Import types and schemas:**

```typescript
import type { BashInput, BashToolDefinition } from '@agent-remote/core';
import { bashInputSchema } from '@agent-remote/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Create a tool definition using core types
export const bashTool: BashToolDefinition = {
  name: 'bash',
  description: 'Execute bash commands on my remote system',
  inputSchema: bashInputSchema,
  handler: async (input: BashInput): Promise<CallToolResult> => {
    // Validate input
    bashInputSchema.parse(input);

    // Connect to your remote system and execute the command
    // (implementation depends on your transport: SSH, Docker, Kubernetes, etc.)

    return {
      content: [{ type: 'text', text: 'command output here' }],
    };
  },
};
```

## Building

```bash
pnpm build  # Generates declaration files only
```

The build command runs `tsc --build` which generates `.d.ts` files and compiles
the source to `.js` for the composite project reference system.

## License

Apache-2.0
