<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">nestjs-restate</h1>

<p align="center">A first-class <a href="https://nestjs.com/">NestJS</a> integration for <a href="https://restate.dev/">Restate</a> — the durable execution engine.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nestjs-restate"><img src="https://img.shields.io/npm/v/nestjs-restate.svg" alt="NPM Version" /></a>
  <a href="https://github.com/zackautocracy/nestjs-restate/actions/workflows/ci.yml"><img src="https://github.com/zackautocracy/nestjs-restate/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/zackautocracy/nestjs-restate"><img src="https://codecov.io/gh/zackautocracy/nestjs-restate/branch/main/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

## Overview

Define Restate workflows, services, and virtual objects as regular NestJS injectable classes. Full dependency injection, auto-discovery, and lifecycle management — no manual wiring required.

- **Decorator-driven** — `@Workflow()`, `@Service()`, `@VirtualObject()`, `@Handler()`, `@Run()`, `@Shared()`
- **Full DI support** — constructor injection works like any NestJS provider
- **Auto-discovery** — decorated classes are registered automatically, no manual wiring
- **SDK configuration passthrough** — retry policies, timeouts, and handler options forwarded to the Restate SDK
- **Multiple endpoint modes** — standalone port, external HTTP/2 server, or AWS Lambda

## Installation

```bash
npm install nestjs-restate @restatedev/restate-sdk @restatedev/restate-sdk-clients
```

### Peer Dependencies

| Package | Version |
|---|---|
| `@nestjs/common` | `>=10.0.0` |
| `@nestjs/core` | `>=10.0.0` |
| `@restatedev/restate-sdk` | `>=1.8.0` |
| `@restatedev/restate-sdk-clients` | `>=1.6.0` |

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

### 2. Define a component

```typescript
import { Service, Handler } from 'nestjs-restate';
import type { Context } from '@restatedev/restate-sdk';

@Service('greeter')
export class GreeterService {
    @Handler()
    async greet(ctx: Context, name: string) {
        return await ctx.run('greeting', () => `Hello, ${name}!`);
    }
}
```

### 3. Register as a provider

```typescript
@Module({
    providers: [GreeterService],
})
export class GreeterModule {}
```

Auto-discovery handles the rest — no manual registration with the Restate endpoint needed.

### 4. Call it

```typescript
import { Injectable } from '@nestjs/common';
import { InjectClient } from 'nestjs-restate';
import type { Ingress } from '@restatedev/restate-sdk-clients';

@Injectable()
export class AppService {
    constructor(@InjectClient() private readonly restate: Ingress) {}

    async greet(name: string) {
        const client = this.restate.serviceClient<GreeterService>({ name: 'greeter' });
        return client.greet(name);
    }
}
```

## Decorators

All class decorators implicitly apply `@Injectable()`.

| Decorator | Description |
|---|---|
| `@Service(name)` | [Restate Service](https://docs.restate.dev/develop/ts/overview/#services) — stateless durable handlers |
| `@VirtualObject(name)` | [Restate Virtual Object](https://docs.restate.dev/develop/ts/virtual-objects/) — keyed stateful handlers |
| `@Workflow(name)` | [Restate Workflow](https://docs.restate.dev/develop/ts/workflows/) — long-running durable process |
| `@Handler()` | Handler method on `@Service`, or exclusive handler on `@VirtualObject` |
| `@Shared()` | Concurrent handler on `@Workflow` or `@VirtualObject` |
| `@Run()` | Entry point of a `@Workflow` (exactly one per workflow) |
| `@InjectClient()` | Injects the Restate `Ingress` client |

Component and handler decorators (`@Service`, `@VirtualObject`, `@Workflow`, `@Handler`, `@Run`, `@Shared`) also accept an optional options object for SDK-level configuration — see [Configuration](#configuration).

## Services

Services are stateless handlers with durable execution. Each call is retried automatically on failure and runs exactly once to completion. Services are ideal for side effects like sending emails, charging payments, or calling external APIs.

```typescript
import { Service, Handler } from 'nestjs-restate';
import type { Context } from '@restatedev/restate-sdk';

@Service('notification')
export class NotificationService {
    constructor(
        private readonly sms: SmsProvider,
        private readonly mailer: MailProvider,
    ) {}

    @Handler()
    async sendSms(ctx: Context, input: { phone: string; message: string }) {
        // ctx.run() makes this side effect durable — it won't re-execute on retry
        await ctx.run('send-sms', () =>
            this.sms.send(input.phone, input.message),
        );
    }

    @Handler()
    async sendEmail(ctx: Context, input: { to: string; subject: string; body: string }) {
        await ctx.run('send-email', () =>
            this.mailer.send(input.to, input.subject, input.body),
        );
    }
}
```

Call a service from elsewhere in your NestJS app:

```typescript
const client = this.restate.serviceClient<NotificationService>({ name: 'notification' });
await client.sendSms({ phone: '+1234567890', message: 'Order shipped!' });
```

## Virtual Objects

Virtual Objects combine durable state with concurrency control. Each object instance is identified by a key, and `@Handler()` methods run with exclusive access (one at a time per key). `@Shared()` methods can run concurrently.

```typescript
import { VirtualObject, Handler, Shared } from 'nestjs-restate';
import type { ObjectContext, ObjectSharedContext } from '@restatedev/restate-sdk';

@VirtualObject('counter')
export class CounterObject {
    @Handler() // exclusive — only one increment runs at a time per key
    async increment(ctx: ObjectContext, input: { amount: number }) {
        const current = (await ctx.get<number>('count')) ?? 0;
        ctx.set('count', current + input.amount);
        return current + input.amount;
    }

    @Shared() // concurrent — multiple reads can run in parallel
    async getCount(ctx: ObjectSharedContext) {
        return (await ctx.get<number>('count')) ?? 0;
    }
}
```

Call a virtual object:

```typescript
const client = this.restate.objectClient<CounterObject>({ name: 'counter' }, 'user-123');
await client.increment({ amount: 1 });
const count = await client.getCount();
```

## Workflows

Workflows are durable, long-running processes with a single `@Run()` entry point. They can suspend on durable promises and receive external signals through `@Shared()` handlers.

```typescript
import { Workflow, Run, Shared } from 'nestjs-restate';
import type { WorkflowContext, WorkflowSharedContext } from '@restatedev/restate-sdk';

@Workflow('payment')
export class PaymentWorkflow {
    constructor(private readonly payments: PaymentService) {}

    @Run()
    async run(ctx: WorkflowContext, input: { orderId: string; amount: number }) {
        const intentId = await ctx.run('create-intent', () =>
            this.payments.createIntent(input.orderId, input.amount),
        );

        // Suspend until an external signal resolves this promise
        const confirmation = await ctx.promise<string>('payment-confirmed');

        await ctx.run('finalize', () =>
            this.payments.finalize(intentId, confirmation),
        );

        return { success: true, intentId };
    }

    @Shared()
    async confirmPayment(ctx: WorkflowSharedContext, input: { confirmationId: string }) {
        ctx.promise<string>('payment-confirmed').resolve(input.confirmationId);
    }
}
```

**Key rules:**
- Exactly **one** `@Run()` per workflow
- `@Shared()` methods can be called concurrently while the workflow is running
- Use `ctx.promise()` for durable signals between run and shared handlers

Call a workflow:

```typescript
const client = this.restate.workflowClient<PaymentWorkflow>({ name: 'payment' }, orderId);

// Start (non-blocking)
await client.workflowSubmit({ orderId, amount });

// Wait for result
const result = await client.workflowAttach();

// Signal the running workflow
await client.confirmPayment({ confirmationId });
```

## Configuration

### Module Options

```typescript
RestateModule.forRoot({
    ingress: 'http://restate:8080',           // Restate ingress URL
    endpoint: { port: 9080 },                 // HTTP/2 endpoint (see Endpoint Modes below)
    admin: 'http://restate:9070',             // Admin API (for auto-registration)
    autoRegister: {                           // Auto-register deployment on startup
        deploymentUrl: 'http://host.docker.internal:9080',
        force: true,                          // Overwrite existing (default: true)
    },
    identityKeys: [                           // Request identity verification keys
        'publickeyv1_...',
    ],
    defaultServiceOptions: {                  // Defaults applied to all components
        retryPolicy: {
            maxAttempts: 10,
            initialInterval: 100,
            exponentiationFactor: 2,
            maxInterval: 30_000,
        },
    },
})
```

### Async Configuration

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
    }),
})
```

### Endpoint Modes

```typescript
endpoint: { port: 9080 }           // Standalone HTTP/2 server
endpoint: { server: myHttp2Server } // Attach to existing server
endpoint: { type: 'lambda' }       // AWS Lambda (no server)
```

> **Why a separate HTTP/2 server?** Restate uses a binary protocol over HTTP/2 bidirectional streaming that can't be mounted as Express/Fastify middleware.

### Component-Level Options

Decorators accept either a string name or an options object for fine-grained SDK configuration:

```typescript
@Service({
    name: 'payments',
    description: 'Payment processing service',
    metadata: { team: 'billing' },
    options: {
        retryPolicy: { maxAttempts: 5, initialInterval: 200 },
        inactivityTimeout: 30_000,
        ingressPrivate: true,
    },
})
export class PaymentService { ... }

@VirtualObject({
    name: 'cart',
    options: {
        enableLazyState: true,
        retryPolicy: { maxAttempts: 10 },
    },
})
export class CartObject { ... }

@Workflow({
    name: 'onboarding',
    options: {
        workflowRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
        retryPolicy: { maxAttempts: 3 },
    },
})
export class OnboardingWorkflow { ... }
```

### Handler-Level Options

Individual handlers can override component-level settings:

```typescript
@Service('orders')
export class OrderService {
    @Handler({ retryPolicy: { maxAttempts: 1 } }) // no retries for idempotent ops
    async cancelOrder(ctx: Context, orderId: string) { ... }

    @Handler({ inactivityTimeout: 60_000 }) // long timeout for slow operations
    async processReturn(ctx: Context, input: ReturnRequest) { ... }
}
```

All SDK option types (`RetryPolicy`, `ServiceOptions`, `ObjectOptions`, `WorkflowOptions`, `ServiceHandlerOpts`, `DefaultServiceOptions`, etc.) are re-exported from `nestjs-restate` for convenience.

### Auto-Registration

When `autoRegister` is set, the module calls the Restate admin API on startup to register the deployment.

| Environment | `deploymentUrl` |
|---|---|
| Docker Desktop | `http://host.docker.internal:9080` |
| Local (no Docker) | `http://localhost:9080` |
| Kubernetes | `http://my-service.default:9080` |

Use `{{port}}` for random port scenarios:
```typescript
endpoint: { port: 0 },
autoRegister: { deploymentUrl: 'http://host.docker.internal:{{port}}' },
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commands, and guidelines.

## License

[MIT](LICENSE)