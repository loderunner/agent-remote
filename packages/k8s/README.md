# @agent-remote/k8s

Kubernetes remote tools for AI agents. Execute commands and manage files on Kubernetes pods.

## Installation

```bash
npm install @agent-remote/k8s
```

## Usage

### Basic Usage

```typescript
import { Remote } from '@agent-remote/k8s';

const remote = new Remote({
  pod: 'my-app-pod',
  namespace: 'default',
  container: 'main', // optional
  shell: 'bash', // optional, defaults to 'sh'
});

// Execute commands
const result = await remote.bash.handler({ command: 'ls -la' });
console.log(result.content[0].text);

// Read files
const fileContent = await remote.read.handler({ file_path: '/etc/hosts' });
console.log(fileContent.content[0].text);
```

### As MCP Server

Run as a standalone MCP server:

```bash
remote-k8s-mcp --pod my-app-pod --namespace default
```

Or use environment variables:

```bash
export K8S_POD=my-app-pod
export K8S_NAMESPACE=default
export K8S_CONTAINER=main
remote-k8s-mcp
```

## Configuration

| Option | CLI Flag | Environment Variable | Default | Description |
|--------|----------|---------------------|---------|-------------|
| pod | `--pod`, `-p` | `K8S_POD` | (required) | Kubernetes pod name |
| namespace | `--namespace`, `-n` | `K8S_NAMESPACE` | `default` | Kubernetes namespace |
| container | `--container`, `-c` | `K8S_CONTAINER` | (optional) | Container name within the pod |
| shell | `--shell`, `-s` | `K8S_SHELL` | `sh` | Shell to use for execution |

## Available Tools

- **bash**: Execute commands in a persistent shell session
- **bash-output**: Retrieve output from background shells
- **kill-bash**: Kill a running background shell
- **grep**: Search for patterns in files
- **read**: Read file contents
- **write**: Write content to files
- **edit**: Edit files by replacing text
- **glob**: Find files matching patterns

## Requirements

- `kubectl` CLI tool must be installed and configured
- Access to the target Kubernetes cluster and pod

## License

Apache-2.0
