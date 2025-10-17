# Examples

This directory contains example projects demonstrating how to use
`@claude-remote/ssh` with the Claude Agent SDK.

## Available Examples

### [simple-agent](./simple-agent)

A basic example showing how to:

- Connect to a remote SSH server
- Create an AI agent with remote execution tools
- Execute multi-step tasks autonomously
- Use the Claude Agent SDK with MCP tools

Perfect for getting started and understanding the fundamentals.

## Running Examples

Each example has its own README with specific instructions. Generally:

1. **Start the sandbox** (from monorepo root):

   ```bash
   cd sandbox
   docker-compose up -d
   cd ..
   ```

2. **Install dependencies** (from monorepo root):

   ```bash
   pnpm install
   pnpm build
   ```

3. **Set your API key**:

   ```bash
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

4. **Run the example**:
   ```bash
   cd examples/simple-agent
   pnpm start
   ```

## Contributing Examples

Have a cool example to share? Add it here! Examples should:

- Be well-documented with a README
- Include clear setup instructions
- Demonstrate a specific use case or pattern
- Work with the included sandbox for easy testing
