# Contributing

Thank you for your interest in contributing to **nestjs-restate**! This guide covers everything you need to get started.

## Development Setup

### Prerequisites

- [mise](https://mise.jdx.dev/) — manages Node.js version
- [Docker](https://www.docker.com/) — runs the Restate server

```sh
mise install        # Install Node.js 22
yarn install        # Install dependencies
```

### Commands

| Command | Description |
| --- | --- |
| `yarn build` | Build the library (CJS + ESM + types) |
| `yarn test` | Run unit tests |
| `yarn test:watch` | Run unit tests in watch mode |
| `yarn test:e2e` | Run E2E tests (requires Docker) |
| `yarn test:coverage` | Run unit tests with coverage |
| `yarn lint` | Check lint and formatting |
| `yarn lint:fix` | Auto-fix lint and formatting |
| `yarn check:types` | Type-check with tsc |
| `yarn check:all` | Run all checks (lint, types, build, test, exports, package) |

### Running the Example App

The `example/` directory contains a working NestJS app that uses the library.

```sh
# Start the Restate server
yarn docker:up

# Start the example with live-reload (resolves library source directly)
yarn example:dev

# Or build the library first and run against built output
yarn example
```

Once running, the example registers itself with the Restate server automatically.

#### Sending Requests

The example exposes a REST controller and Restate components. Use curl to interact:

**Add items to a cart** (virtual object with keyed state):

```sh
curl -X POST http://localhost:3000/cart/alice/items \
  -H 'content-type: application/json' \
  -d '{"productId": "p1", "name": "Widget", "price": 12.50, "quantity": 2}'

# Read cart (shared handler — concurrent reads)
curl http://localhost:3000/cart/alice
```

**Charge a payment** (stateless durable service):

```sh
curl -X POST http://localhost:3000/payments/charge \
  -H 'content-type: application/json' \
  -d '{"amount": 25.00, "currency": "USD"}'
```

**Run the order workflow** (durable execution with signals):

```sh
# Start an order (blocks until shipment is confirmed)
curl -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{"userId": "alice", "orderId": "order-1"}'

# In another terminal, confirm shipment to unblock the workflow
curl -X POST http://localhost:3000/orders/order-1/confirm-shipment \
  -H 'content-type: application/json' \
  -d '{"trackingNumber": "TRACK-123"}'
```

The workflow blocks at `ctx.promise("shipment-confirmed")` until `confirmShipment` is called, demonstrating durable execution and signaling.

You can also call Restate components directly via the Restate ingress (port 8080):

```sh
curl -X POST http://localhost:8080/payment/charge \
  -H 'content-type: application/json' \
  -d '{"amount": 25.00, "currency": "USD"}'
```

#### Stopping

```sh
yarn docker:down
```

## Architecture

```text
lib/
├── context/             # RestateContext injectable + AsyncLocalStorage context store
├── decorators/          # @Service, @VirtualObject, @Workflow, @Handler, @Run, @Signal, @Shared, @InjectClient
├── discovery/           # RestateExplorer — discovers decorated classes via NestJS DiscoveryService
├── endpoint/            # RestateEndpointManager — manages HTTP/2 server lifecycle
├── proxy/               # Typed client proxy factory + DI token management
├── registry/            # Global component registry for auto-discovery
├── restate.module.ts    # RestateModule.forRoot() / forRootAsync()
├── restate.constants.ts # DI tokens
└── restate.interfaces.ts # Type definitions
```

## Testing

Unit tests mirror the source structure under `test/unit/`. E2E tests with a real Restate server (via testcontainers) are in `test/e2e/`, with the test fixture in `test/e2e/fixture/` mirroring the example app's feature-module structure.

```sh
yarn test          # Unit tests only (fast, no Docker)
yarn test:e2e      # E2E tests (requires Docker)
```

SWC is required for tests because Vitest's esbuild transform doesn't support `emitDecoratorMetadata`, which NestJS dependency injection relies on.

## Pull Request Guidelines

- Keep PRs focused on a single change.
- Include tests for new functionality. If tests are not applicable, explain why in the PR description.
- Update documentation if the change affects the public API.
- Ensure CI passes before requesting review.
- Reference related issues in the PR description (e.g., `Fixes #123`).

## Reporting Bugs

Use the [Bug Report](https://github.com/razakiau/nestjs-restate/issues/new?template=bug_report.yml) template. Include a minimal reproduction.

## Requesting Features

Use the [Feature Request](https://github.com/razakiau/nestjs-restate/issues/new?template=feature_request.yml) template. Explain the use case and proposed API.

## Questions

For questions and help, use [GitHub Discussions](https://github.com/razakiau/nestjs-restate/discussions) instead of issues.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
