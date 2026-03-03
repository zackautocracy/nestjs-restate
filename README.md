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
  <a href="https://deepwiki.com/zackautocracy/nestjs-restate"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki" /></a>
</p>

## Overview

Define Restate workflows, services, and virtual objects as regular NestJS injectable classes. Full dependency injection, auto-discovery, and lifecycle management — no manual wiring required.

- **Decorator-driven** — `@Workflow()`, `@Service()`, `@VirtualObject()`, `@Handler()`, `@Run()`, `@Signal()`, `@Shared()`
- **Full DI support** — constructor injection works like any NestJS provider
- **Injectable context** — `RestateContext` gives handler methods access to the Restate SDK context via DI
- **Typed service proxies** — call other Restate services with full type safety via `@InjectClient(ServiceClass)`
- **Auto-discovery** — decorated classes are registered automatically, no manual wiring
- **SDK configuration passthrough** — retry policies, timeouts, and handler options forwarded to the Restate SDK
- **Replay-aware logging** — NestJS `Logger` calls are automatically silenced during replay, zero config
- **Multiple endpoint modes** — standalone port, external HTTP/2 server, or AWS Lambda

## Installation

```bash
npm install nestjs-restate @restatedev/restate-sdk @restatedev/restate-sdk-clients
```

### Peer Dependencies

| Package | Version |
|---|---|
| `@nestjs/common` | `^10.0.0 \|\| ^11.0.0` |
| `@nestjs/core` | `^10.0.0 \|\| ^11.0.0` |
| `@restatedev/restate-sdk` | `^1.10.4` |
| `@restatedev/restate-sdk-clients` | `^1.10.4` |

## Quick Start

### 1. Import the module

```typescript
import { Module } from '@nestjs/common';
import { RestateModule } from 'nestjs-restate';
import { GreeterService } from './greeter.service';

@Module({
    imports: [
        RestateModule.forRoot({
            ingress: 'http://restate:8080',
            endpoint: { port: 9080 },
        }),
    ],
    providers: [GreeterService],
})
export class AppModule {}
```

### 2. Define a component

```typescript
import { Service, Handler, RestateContext } from 'nestjs-restate';

@Service('greeter')
export class GreeterService {
    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async greet(name: string) {
        return await this.ctx.run('greeting', () => `Hello, ${name}!`);
    }
}
```

The Restate SDK context is no longer passed as a handler parameter. Instead, inject `RestateContext` via the constructor — it automatically resolves to the correct context for each request using `AsyncLocalStorage`.

### 3. Register as a provider

```typescript
@Module({
    providers: [GreeterService],
})
export class GreeterModule {}
```

Auto-discovery handles the rest — no manual registration with the Restate endpoint needed.

### 4. Call it

**Typed proxy** (recommended for inter-service calls) — any `@Service`, `@VirtualObject`, or `@Workflow` class is auto-discovered and available for injection. Typed proxies use `AsyncLocalStorage` and **only work inside Restate handler methods** (i.e., methods decorated with `@Handler()`, `@Run()`, `@Signal()`, or `@Shared()`):

```typescript
import { Service, Handler, InjectClient, type ServiceClient } from 'nestjs-restate';
import { GreeterService } from './greeter.service';

@Service('orchestrator')
export class OrchestratorService {
    constructor(
        @InjectClient(GreeterService) private readonly greeter: ServiceClient<GreeterService>,
    ) {}

    @Handler()
    async orchestrate(input: { name: string }) {
        return this.greeter.greet(input.name);
    }
}
```

**Raw Ingress client** — for calling Restate services from outside handler context (REST controllers, cron jobs, etc.):

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
| `@Shared()` | Concurrent handler on `@VirtualObject` (for reads that can run in parallel) |
| `@Signal()` | Signal handler on `@Workflow` (receives external signals while the workflow runs) |
| `@Run()` | Entry point of a `@Workflow` (exactly one per workflow) |
| `@InjectClient()` | Injects the Restate `Ingress` client (for use outside handler context) |
| `@InjectClient(ServiceClass)` | Injects a typed service proxy (handler context only — uses AsyncLocalStorage) |

| Injectable | Description |
|---|---|
| `RestateContext` | Injectable wrapper around the Restate SDK context — automatically scoped to the current request via `AsyncLocalStorage` |

Component and handler decorators (`@Service`, `@VirtualObject`, `@Workflow`, `@Handler`, `@Run`, `@Signal`, `@Shared`) also accept an optional options object for SDK-level configuration — see [Configuration](#configuration).

### Context API

`RestateContext` exposes the full Restate SDK context surface. All methods delegate to the underlying SDK — no custom behavior is added.

| Category | Method | Description |
|----------|--------|-------------|
| Durable Execution | `run(action)`, `run(name, action)`, `run(name, action, options)` | Execute and persist side effects |
| Timers | `sleep(duration, name?)` | Durable sleep |
| Awakeables | `awakeable(serde?)`, `resolveAwakeable(id, payload?, serde?)`, `rejectAwakeable(id, reason)` | External event completion |
| State | `get(key, serde?)`, `set(key, value, serde?)`, `clear(key)`, `clearAll()`, `stateKeys()` | Key-value store (objects/workflows) |
| Promises | `promise(name, serde?)` | Workflow durable promises |
| Invocations | `request()`, `cancel(invocationId)`, `attach(invocationId, serde?)` | Invocation lifecycle |
| Generic Calls | `genericCall(call)`, `genericSend(call)` | Untyped service invocation |
| Deterministic | `rand`, `date` | Seeded random & deterministic clock |
| Observability | `console` | Replay-aware logging |
| Identity | `key` | Object/workflow key |
| Escape Hatch | `raw` | Direct SDK context access |

For service-to-service calls, use `@InjectClient()` with typed proxies instead of `ctx.serviceClient()`. See [Typed Service Proxies](#4-call-it).

## Services

Services are stateless handlers with durable execution. Each call is retried automatically on failure and runs exactly once to completion. Services are ideal for side effects like sending emails, charging payments, or calling external APIs.

```typescript
import { Service, Handler, RestateContext } from 'nestjs-restate';

@Service('notification')
export class NotificationService {
    constructor(
        private readonly ctx: RestateContext,
        private readonly sms: SmsProvider,
        private readonly mailer: MailProvider,
    ) {}

    @Handler()
    async sendSms(input: { phone: string; message: string }) {
        // ctx.run() makes this side effect durable — it won't re-execute on retry
        await this.ctx.run('send-sms', () =>
            this.sms.send(input.phone, input.message),
        );
    }

    @Handler()
    async sendEmail(input: { to: string; subject: string; body: string }) {
        await this.ctx.run('send-email', () =>
            this.mailer.send(input.to, input.subject, input.body),
        );
    }
}
```

Call a service using a typed proxy:

```typescript
@Injectable()
export class OrderService {
    constructor(
        @InjectClient(NotificationService) private readonly notifications: ServiceClient<NotificationService>,
    ) {}

    async notifyShipped(phone: string) {
        await this.notifications.sendSms({ phone, message: 'Order shipped!' });
    }
}
```

## Virtual Objects

Virtual Objects combine durable state with concurrency control. Each object instance is identified by a key, and `@Handler()` methods run with exclusive access (one at a time per key). `@Shared()` methods can run concurrently.

```typescript
import { VirtualObject, Handler, Shared, RestateContext } from 'nestjs-restate';

@VirtualObject('counter')
export class CounterObject {
    constructor(private readonly ctx: RestateContext) {}

    @Handler() // exclusive — only one increment runs at a time per key
    async increment(input: { amount: number }) {
        const current = (await this.ctx.get<number>('count')) ?? 0;
        this.ctx.set('count', current + input.amount);
        return current + input.amount;
    }

    @Shared() // concurrent — multiple reads can run in parallel
    async getCount() {
        return (await this.ctx.get<number>('count')) ?? 0;
    }
}
```

Call a virtual object using a typed proxy:

```typescript
@Injectable()
export class DashboardService {
    constructor(
        @InjectClient(CounterObject) private readonly counter: ObjectClient<CounterObject>,
    ) {}

    async incrementUser(userId: string) {
        await this.counter.key(userId).increment({ amount: 1 });
        return this.counter.key(userId).getCount();
    }
}
```

## Workflows

Workflows are durable, long-running processes with a single `@Run()` entry point. They can suspend on durable promises and receive external signals through `@Signal()` handlers.

```typescript
import { Workflow, Run, Signal, RestateContext } from 'nestjs-restate';

@Workflow('payment')
export class PaymentWorkflow {
    constructor(
        private readonly ctx: RestateContext,
        private readonly gateway: PaymentGateway, // regular NestJS provider (not a Restate service)
    ) {}

    @Run()
    async run(input: { orderId: string; amount: number }) {
        const intentId = await this.ctx.run('create-intent', () =>
            this.gateway.createIntent(input.orderId, input.amount),
        );

        // Suspend until an external signal resolves this promise
        const confirmation = await this.ctx.promise<string>('payment-confirmed');

        await this.ctx.run('finalize', () =>
            this.gateway.finalize(intentId, confirmation),
        );

        return { success: true, intentId };
    }

    @Signal()
    async confirmPayment(input: { confirmationId: string }) {
        this.ctx.promise<string>('payment-confirmed').resolve(input.confirmationId);
    }
}
```

**Key rules:**
- Exactly **one** `@Run()` per workflow — the method **must** be named `run`
- `@Signal()` methods can be called concurrently while the workflow is running
- Use `this.ctx.promise()` for durable signals between run and signal handlers

Call a workflow from another Restate handler using a typed proxy:

```typescript
import { Service, Handler, InjectClient, type WorkflowClient } from 'nestjs-restate';
import { PaymentWorkflow } from './payment.workflow';

@Service('checkout')
export class CheckoutService {
    constructor(
        @InjectClient(PaymentWorkflow) private readonly payment: WorkflowClient<PaymentWorkflow>,
    ) {}

    @Handler()
    async startPayment(input: { orderId: string; amount: number }) {
        // Start (non-blocking — fire-and-forget via .send)
        this.payment.key(input.orderId).send.run({ orderId: input.orderId, amount: input.amount });

        // Signal the running workflow
        await this.payment.key(input.orderId).confirmPayment({ confirmationId: 'conf-123' });
    }
}
```

## Error Handling

Restate automatically **retries** handler invocations when they fail. Understanding when to stop retries is key to building correct services.

### Terminal vs Retryable Errors

| Error type | Restate behavior |
|---|---|
| Regular `Error` | **Retried** according to the retry policy (default: infinite) |
| `TerminalError` | **Not retried** — failure is written as output and returned to the caller |
| `RetryableError` | **Retried** with an optional `retryAfter` delay hint |
| `TimeoutError` | `TerminalError` subclass (code 408) — returned by `ctx.promise().orTimeout()` |
| `CancelledError` | `TerminalError` subclass (code 409) — when an invocation is cancelled |

### Usage

Use `TerminalError` for non-retryable failures like validation errors, business rule violations, or permanent failures:

```typescript
import { Service, Handler, RestateContext, TerminalError } from 'nestjs-restate';

@Service('orders')
export class OrderService {
    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async placeOrder(input: { userId: string; items: string[] }) {
        if (input.items.length === 0) {
            // Won't retry — this is a client error
            throw new TerminalError('Cart is empty', { errorCode: 400 });
        }

        // Regular errors (e.g., network failures) are retried automatically
        await this.ctx.run('charge-payment', () => paymentGateway.charge(input));
    }
}
```

### Global Error Mapping

Use `asTerminalError` to automatically convert domain-specific errors into terminal errors:

```typescript
RestateModule.forRoot({
    ingress: 'http://restate:8080',
    endpoint: { port: 9080 },
    defaultServiceOptions: {
        asTerminalError: (error) => {
            if (error instanceof ValidationError) {
                return new TerminalError(error.message, { errorCode: 400 });
            }
            if (error instanceof NotFoundError) {
                return new TerminalError(error.message, { errorCode: 404 });
            }
            // Return undefined → Restate retries as normal
        },
    },
})
```

This also works per-component via decorator options:

```typescript
@Service({
    name: 'payments',
    options: {
        asTerminalError: (error) => {
            if (error instanceof InsufficientFundsError) {
                return new TerminalError('Insufficient funds', { errorCode: 402 });
            }
        },
    },
})
```

All error classes (`TerminalError`, `RetryableError`, `TimeoutError`, `CancelledError`, `RestateError`) are re-exported from `nestjs-restate`.

## Logging

`nestjs-restate` ships a **replay-aware logger** that works automatically — no setup required.

### How It Works

Restate replays handler invocations to rebuild state after crashes. During replay, log statements would produce duplicate, misleading output. The replay-aware logger solves this at two levels:

| Direction | What happens |
|---|---|
| **NestJS → Restate** | `Logger.overrideLogger()` redirects all NestJS log calls. Inside a handler, logs are forwarded to `ctx.console` (replay-aware). Outside a handler, logs fall through to a standard `ConsoleLogger`. |
| **Restate → NestJS** | A custom `LoggerTransport` is passed to `createEndpointHandler()`. SDK-internal messages are formatted with NestJS-style ANSI colors and written directly to stdout/stderr, and silenced during replay. |

### Usage

Use the standard NestJS `Logger` — it's replay-safe inside handlers with zero extra code:

```typescript
import { Logger } from '@nestjs/common';
import { Service, Handler, RestateContext } from 'nestjs-restate';

@Service('greeter')
export class GreeterService {
    private readonly logger = new Logger(GreeterService.name);

    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async greet(name: string) {
        this.logger.log(`Greeting ${name}`);           // silenced during replay
        this.logger.debug(`Building greeting string`); // silenced during replay

        const greeting = await this.ctx.run('greeting', () => `Hello, ${name}!`);

        this.logger.log(`Greeting ready: ${greeting}`); // silenced during replay
        return greeting;
    }
}
```

You can also call `this.ctx.console` directly — both approaches are replay-safe:

```typescript
this.ctx.console.log('direct SDK logging');   // also silenced during replay
```

### Level Mapping

| NestJS level | Restate `ctx.console` method |
|---|---|
| `log` | `info` |
| `error` | `error` |
| `warn` | `warn` |
| `debug` | `debug` |
| `verbose` | `trace` |
| `fatal` | `error` |

### Exports

All logging primitives are re-exported from `nestjs-restate` if you need to customize:

```typescript
import {
    RestateLoggerService,           // NestJS LoggerService implementation
    createRestateLoggerTransport,   // SDK LoggerTransport factory
    type LoggerTransport,           // SDK type
    type LoggerContext,             // SDK type
    type LogMetadata,               // SDK type
} from 'nestjs-restate';
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
    constructor(private readonly ctx: RestateContext) {}

    @Handler({ retryPolicy: { maxAttempts: 1 } }) // no retries for idempotent ops
    async cancelOrder(orderId: string) { ... }

    @Handler({ inactivityTimeout: 60_000 }) // long timeout for slow operations
    async processReturn(input: ReturnRequest) { ... }
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

## Migrating from v1

See [MIGRATION.md](MIGRATION.md) for a complete migration guide with before/after examples.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commands, and guidelines.

## License

[MIT](LICENSE)