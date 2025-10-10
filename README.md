# Claude Remote Dev Sandbox

A containerized Ubuntu development environment accessible via SSH.

## Prerequisites

- Docker and Docker Compose
- SSH client

## Setup

The project includes SSH keys for authentication. If you need to regenerate
them:

```bash
ssh-keygen -t ed25519 -f ssh_key -N "" -C "dev@sandbox"
```

## Running the Sandbox

Build and start the container:

```bash
docker-compose up -d
```

This will:

- Build an Ubuntu 22.04 image with OpenSSH and dev tools
- Start the container named `sandbox`
- Expose SSH on port 2222
- Mount the public key for authentication

## Connecting

SSH into the dev sandbox:

```bash
ssh -i ssh_key -p 2222 dev@localhost
```

Or use password authentication (password: `dev`):

```bash
ssh -p 2222 dev@localhost
```

The `dev` user has passwordless sudo access.

## Development

### Installation

Install dependencies:

```bash
pnpm install
```

### Testing

**Important:** The test suite requires the sandbox container to be running.
Tests are integration tests that connect to the actual SSH sandbox rather than
using mocks.

Start the sandbox before running tests:

```bash
docker-compose up -d
```

Run the tests:

```bash
pnpm test
```

The tests will connect to `localhost:2222` with credentials `dev:dev` and
execute real commands over SSH.

### Building

Build the project:

```bash
pnpm build
```

### Linting

Check code formatting and linting:

```bash
pnpm lint
```

## Managing the Container

Stop the container:

```bash
docker-compose down
```

View logs:

```bash
docker-compose logs -f
```

Rebuild after Dockerfile changes:

```bash
docker-compose up -d --build
```

## Installed Tools

- Git
- curl, wget
- vim, nano
- build-essential (gcc, g++, make)
- sudo
