# Test Sandbox

This directory contains the test environment for agent-remote packages.

## Components

### Docker Container (SSH & Docker testing)
- **Container**: `sandbox`
- **SSH Port**: 2222
- **Credentials**: dev/dev
- Used for testing SSH and Docker remote implementations

### Kubernetes (K8s testing)
- **Kind Cluster**: `kind-control-plane`
- **Pod**: `sandbox` in `default` namespace
- Used for testing Kubernetes remote implementation

## Setup

### Starting the environment

```bash
# Start Docker container and Kind cluster
cd sandbox
docker-compose up -d

# Wait for containers to be ready
sleep 5

# Setup the Kind cluster and deploy the sandbox pod
./setup-kind.sh
```

### Verifying the setup

```bash
# Check Docker container
docker exec sandbox echo "Docker container is ready"

# Check SSH access
ssh -p 2222 dev@localhost

# Check Kind cluster
docker exec kind-control-plane kubectl get nodes
docker exec kind-control-plane kubectl get pods

# Check pod access
docker exec kind-control-plane kubectl exec sandbox -- echo "K8s pod is ready"
```

## Running Tests

From the repository root:

```bash
# Run all integration tests
pnpm -r test:integration

# Run tests for specific packages
pnpm --filter @agent-remote/docker test:integration
pnpm --filter @agent-remote/ssh test:integration
pnpm --filter @agent-remote/k8s test:integration

# Run integration tests that cover all implementations
pnpm --filter integration-tests test
```

## Cleanup

```bash
docker-compose down -v
```

## Fixtures

The `fixtures/` directory contains test files that are mounted into both the Docker container and copied into the K8s pod:

- `simple.txt` - Basic text file
- `log.txt` - Log file with patterns for grep testing
- `mixed-case.txt` - File with mixed case content
- `code/` - Sample code files (app.js, config.py, utils.ts)
- `docs/` - Documentation files (API.md, README.md)
- `nested/deep/` - Nested directory structure
- `hidden/` - Hidden files and directories

## Troubleshooting

### Kind cluster not starting

```bash
# Check if the control plane is running
docker ps | grep kind-control-plane

# Check logs
docker logs kind-control-plane

# Restart
docker-compose restart kind-control-plane
./setup-kind.sh
```

### Pod not ready

```bash
# Check pod status
docker exec kind-control-plane kubectl get pod sandbox -o yaml

# Check pod logs
docker exec kind-control-plane kubectl logs sandbox

# Recreate pod
docker exec kind-control-plane kubectl delete pod sandbox
./setup-kind.sh
```

### SSH connection issues

```bash
# Check SSH service
docker exec sandbox service ssh status

# Check SSH logs
docker exec sandbox tail -f /var/log/auth.log
```
