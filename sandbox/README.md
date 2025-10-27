# agent-remote Dev Sandbox

A containerized Ubuntu development environment accessible via SSH.

## Prerequisites

- Docker and Docker Compose
- SSH client

## Running the Sandbox

Build and start the container:

```bash
cd sandbox
docker-compose up -d
```

This will:

- Build an Ubuntu 22.04 image with OpenSSH and dev tools
- Start the container named `sandbox`
- Expose SSH on port 2222
- Mount the public key for authentication
- Mount test fixtures at `/home/dev/fixtures`

## Connecting

SSH into the dev sandbox:

```bash
ssh -i sandbox/ssh_key -p 2222 dev@localhost
```

Or use password authentication (password: `dev`):

```bash
ssh -p 2222 dev@localhost
```

The `dev` user has passwordless sudo access.

## Test Fixtures

The sandbox includes test fixtures mounted at `/home/dev/fixtures`:

- `code/` - Sample code files (app.js, config.py, utils.ts)
- `docs/` - Documentation files (API.md, README.md)
- `empty/` - Empty directory
- `hidden/` - Hidden files and directories
- `nested/deep/` - Nested directory structure
- Various text files for testing (simple.txt, log.txt, mixed-case.txt)

## Managing the Container

Stop the container:

```bash
cd sandbox
docker-compose down
```

View logs:

```bash
cd sandbox
docker-compose logs -f
```

Rebuild after Dockerfile changes:

```bash
cd sandbox
docker-compose up -d --build
```

## Installed Tools

- Git
- curl, wget
- vim, nano
- build-essential (gcc, g++, make)
- sudo
