# nestjs-restate

[![npm version](https://img.shields.io/npm/v/nestjs-restate.svg)](https://www.npmjs.com/package/nestjs-restate)
[![CI](https://github.com/ZackAutocracy/nestjs-restate/actions/workflows/ci.yml/badge.svg)](https://github.com/ZackAutocracy/nestjs-restate/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ZackAutocracy/nestjs-restate/branch/main/graph/badge.svg)](https://codecov.io/gh/ZackAutocracy/nestjs-restate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A first-class [NestJS](https://nestjs.com/) integration for [Restate](https://restate.dev/) — the durable execution engine. Define workflows, services, and virtual objects as regular NestJS injectable classes with decorators, getting full dependency injection, auto-discovery, and lifecycle management out of the box.

## Features

- **Full NestJS Dependency Injection** — constructor injection works exactly like `@Controller()` or any other NestJS provider
- **Decorator-based API** — `@Workflow()`, `@Service()`, `@VirtualObject()` class decorators, `@Run()`, `@Handler()`, `@Shared()` method decorators
- **Auto-discovery** — no manual registration needed; decorated classes are found automatically via NestJS `DiscoveryService`
- **HTTP/2 lifecycle management** — the Restate endpoint starts on module init and gracefully shuts down on destroy
- **Async configuration** — `forRootAsync()` supports `ConfigService` and any other async factory patterns
- **Multiple endpoint modes** — standalone port, external HTTP/2 server, or AWS Lambda
- **Auto-registration** — optionally registers the deployment with the Restate server on startup
- **Zero wrapping of Restate context** — handler methods receive real `WorkflowContext`, `ObjectContext`, etc. from the SDK

## Installation

```bash
# npm
npm install nestjs-restate @restatedev/restate-sdk @restatedev/restate-sdk-clients

# yarn
yarn add nestjs-restate @restatedev/restate-sdk @restatedev/restate-sdk-clients

# pnpm
pnpm add nestjs-restate @restatedev/restate-sdk @restatedev/restate-sdk-clients
```

### Peer Dependencies

| Package | Version |
|---|---|
| `@nestjs/common` | `>=10.0.0` |
| `@nestjs/core` | `>=10.0.0` |
| `@restatedev/restate-sdk` | `>=1.6.0` |
| `@restatedev/restate-sdk-clients` | `>=1.6.0` |
| `reflect-metadata` | `>=0.1.0` |
| `rxjs` | `>=7.0.0` |

## Quick Start

### 1. Import the module

```typescript
import { Module } from '@nestjs/common';
import { RestateModule } from 'nestjs-restate';

@Module({
    imports: [
        RestateModule.forRoot({
            ingress: 'http://restate:8080',
            endpoint: { port: 9080 },
        }),
    ],
})
export class AppModule {}
```

### 2. Define a workflow

```typescript
import { Workflow, Run, Shared } from 'nestjs-restate';
import type { WorkflowContext, WorkflowSharedContext } from 'nestjs-restate';

@Workflow('payment')
export class PaymentWorkflow {
    constructor(private readonly paymentService: PaymentService) {}

    @Run()
    async run(ctx: WorkflowContext, input: { orderId: string; amount: number }) {
        const intentId = await ctx.run('create-intent', () =>
            this.paymentService.createIntent(input.orderId, input.amount),
        );

        const confirmation = await ctx.promise<string>('payment-confirmed');

        await ctx.run('finalize', () =>
            this.paymentService.finalize(intentId, confirmation),
        );

        return { success: true, intentId };
    }

    @Shared()
    async confirmPayment(ctx: WorkflowSharedContext, input: { confirmationId: string }) {
        ctx.promise<string>('payment-confirmed').resolve(input.confirmationId);
    }
}
```

### 3. Register it as a provider

Add the workflow to any module's `providers` array — auto-discovery handles the rest:

```typescript
@Module({
    providers: [PaymentWorkflow, PaymentService],
})
export class PaymentModule {}
```

### 4. Call it from your application

```typescript
import { Injectable } from '@nestjs/common';
import { InjectClient } from 'nestjs-restate';
import type { Ingress } from '@restatedev/restate-sdk-clients';

@Injectable()
export class OrderService {
    constructor(@InjectClient() private readonly restate: Ingress) {}

    async placeOrder(orderId: string, amount: number) {
        const client = this.restate.workflowClient<PaymentWorkflow>(
            { name: 'payment' },
            orderId,
        );
        await client.workflowSubmit({ orderId, amount });
    }

    async confirmPayment(orderId: string, confirmationId: string) {
        const client = this.restate.workflowClient<PaymentWorkflow>(
            { name: 'payment' },
            orderId,
        );
        await client.confirmPayment({ confirmationId });
    }
}
```

## Module Configuration

### `forRoot()`

```typescript
RestateModule.forRoot({
    ingress: 'http://restate:8080',      // Required: Restate server ingress URL
    endpoint: { port: 9080 },            // Required: HTTP/2 endpoint configuration
    admin: 'http://restate:9070',         // Optional: Restate admin URL
    autoRegister: {                       // Optional: Auto-register on startup
        deploymentUrl: 'http://host.docker.internal:9080',
    },
})
```

### `forRootAsync()`

```typescript
import { ConfigService } from '@nestjs/config';

RestateModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
        ingress: config.getOrThrow('RESTATE_INGRESS_URL'),
        admin: config.get('RESTATE_ADMIN_URL'),
        endpoint: {
            port: parseInt(config.getOrThrow('RESTATE_ENDPOINT_PORT'), 10),
        },
        autoRegister: config.get('NODE_ENV') === 'development'
            ? { deploymentUrl: `http://host.docker.internal:${config.getOrThrow('RESTATE_ENDPOINT_PORT')}` }
            : undefined,
    }),
})
```

### Endpoint Modes

```typescript
// Standalone: creates and manages an HTTP/2 server
endpoint: { port: 9080 }

// External server: attach to an existing HTTP/2 server
endpoint: { server: myHttp2Server }

// Lambda: serverless mode (no server created)
endpoint: { type: 'lambda' }
```

> **Why a separate HTTP/2 server?** Restate communicates over HTTP/2 bidirectional streaming. Express/Fastify (used by NestJS) only support HTTP/1.1. The library runs a dedicated HTTP/2 server alongside your NestJS application.

### Auto-Registration

When `autoRegister` is set, the module registers the deployment with the Restate admin API on startup. This is useful during development so you don't need to manually `curl` the admin endpoint.

```typescript
autoRegister: {
    deploymentUrl: 'http://host.docker.internal:9080',  // Where Restate can reach your service
    force: true,                                         // Overwrite existing deployments (default)
}
```

The `deploymentUrl` depends on your environment:

| Environment | `deploymentUrl` |
|---|---|
| Docker Desktop | `http://host.docker.internal:9080` |
| Local (no Docker) | `http://localhost:9080` |
| Kubernetes | `http://my-service.default:9080` |
| Docker-in-Docker / CI | `http://<container-ip>:9080` |

When using random ports (`port: 0`), use the `{{port}}` placeholder:

```typescript
endpoint: { port: 0 },
autoRegister: { deploymentUrl: 'http://host.docker.internal:{{port}}' },
```

## Decorators

### Class Decorators

All class decorators implicitly apply `@Injectable()`, so you never need both.

| Decorator | Description |
|---|---|
| `@Workflow(name)` | Registers a [Restate Workflow](https://docs.restate.dev/develop/ts/workflows/) |
| `@Service(name)` | Registers a [Restate Service](https://docs.restate.dev/develop/ts/overview/#services) |
| `@VirtualObject(name)` | Registers a [Restate Virtual Object](https://docs.restate.dev/develop/ts/virtual-objects/) |

### Method Decorators

| Decorator | Description |
|---|---|
| `@Run()` | Main entry point of a `@Workflow` (exactly one per workflow) |
| `@Handler()` | Handler method on `@Service` or exclusive handler on `@VirtualObject` |
| `@Shared()` | Concurrent handler on `@Workflow` or `@VirtualObject` |

### Injection Decorators

| Decorator | Description |
|---|---|
| `@InjectClient()` | Injects the Restate `Ingress` client for calling workflows/services |

## Services

Services are stateless handlers with durable execution and automatic retries.

```typescript
@Service('notification')
export class NotificationService {
    constructor(private readonly sms: SmsProvider) {}

    @Handler()
    async sendSms(ctx: Context, input: { phone: string; message: string }) {
        await ctx.run('send-sms', () =>
            this.sms.send(input.phone, input.message),
        );
    }
}
```

## Virtual Objects

Virtual Objects combine state and concurrency control, identified by a key.

```typescript
@VirtualObject('counter')
export class CounterObject {
    @Handler()
    async increment(ctx: ObjectContext, input: { amount: number }) {
        const current = (await ctx.get<number>('count')) ?? 0;
        ctx.set('count', current + input.amount);
        return current + input.amount;
    }

    @Shared()
    async getCount(ctx: ObjectSharedContext) {
        return (await ctx.get<number>('count')) ?? 0;
    }
}
```

## Contributing

Contributions are welcome! This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Lint
yarn lint

# Full quality check
yarn check:all
```

## License

[MIT](LICENSE)