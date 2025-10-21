# Claude Remote Dev Sandbox

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
cd sandbox
docker-compose up -d
cd ..
```

Run the tests:

```bash
pnpm test
```

The tests will connect to `localhost:2222` with credentials `dev:dev` and
execute real commands over SSH. Test fixtures are available at
`/home/dev/fixtures` in the container.

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
