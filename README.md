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

NestJS services don't survive crashes. If your app restarts mid-request, in-progress work is lost — partial payments, half-sent notifications, orphaned state.

[Restate](https://restate.dev/) is a durable execution engine that fixes this. Every function call is persisted and automatically retried from where it left off — no manual retry logic, idempotency keys, or state machines. **nestjs-restate** brings Restate into NestJS as a first-class citizen with decorators, dependency injection, auto-discovery, and lifecycle management.

**What you get:**

- **Decorator-driven** — `@Service()`, `@VirtualObject()`, `@Workflow()`, `@Handler()`
- **Full DI support** — constructor injection works like any NestJS provider
- **Injectable context** — `RestateContext` gives handler methods access to the Restate SDK context
- **Typed service proxies** — call other Restate services with full type safety via `@InjectClient(ServiceClass)`
- **Typed Ingress client** — call Restate services from REST controllers and cron jobs using decorated classes directly
- **Auto-discovery** — decorated classes are registered automatically, no manual wiring
- **NestJS execution pipeline** — guards, interceptors, pipes, and exception filters work on Restate handlers
- **Replay-aware logging** — NestJS `Logger` calls are automatically silenced during replay
- **SDK passthrough** — retry policies, timeouts, and handler options forwarded directly to the Restate SDK

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

### Running Restate

You also need a running [Restate server](https://docs.restate.dev/installation). The quickest way to get started locally:

```bash
# Docker
docker run --name restate -p 8080:8080 -p 9070:9070 docker.io/restatedev/restate:latest

# or Homebrew
brew install restatedev/tap/restate-server && restate-server
```

See the Restate deployment docs for [Kubernetes](https://docs.restate.dev/services/deploy/kubernetes), [AWS Lambda](https://docs.restate.dev/services/deploy/lambda), and other deployment options.

## Quick Start

### 1. Import the module

```typescript
import { Module } from '@nestjs/common';
import { RestateModule } from 'nestjs-restate';

@Module({
    imports: [
        RestateModule.forRoot({
            ingress: 'http://localhost:8080',
            endpoint: { port: 9080 },
        }),
    ],
})
export class AppModule {}
```

### 2. Define a service

```typescript
import { Service, Handler, RestateContext } from 'nestjs-restate';

// stripe, mailer, db etc. in these examples are your own providers — not provided by this package

@Service('payments')
export class PaymentService {
    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async charge(input: { userId: string; amount: number }) {
        // ctx.run() makes this side effect durable:
        // if the service crashes after charging, Restate won't re-charge on retry
        const receipt = await this.ctx.run('charge-card', () =>
            stripe.charges.create({ amount: input.amount, customer: input.userId }),
        );

        await this.ctx.run('send-receipt', () =>
            mailer.send(input.userId, `Charged $${input.amount}. Receipt: ${receipt.id}`),
        );

        return { receiptId: receipt.id };
    }
}
```

> **How `ctx.run()` works**: Restate journals the result of each `ctx.run()` call. On retry, it replays the journaled result instead of re-executing the function. This is what makes side effects like payments and emails safe without manual idempotency keys.

The Restate SDK context is not passed as a handler parameter. Instead, inject `RestateContext` via the constructor — it automatically resolves to the correct context for each request using `AsyncLocalStorage`.

### 3. Register as a provider

```typescript
@Module({
    providers: [PaymentService],
})
export class PaymentModule {}
```

Auto-discovery handles the rest — no manual registration with the Restate endpoint needed.

## Concepts

Restate has three component types. Each is defined as a regular NestJS class with a decorator.

### Services

Stateless durable handlers. Handlers are durable — if the service crashes mid-execution, Restate automatically retries from the last checkpoint, not from the beginning. Use services for side effects like sending emails, charging payments, or calling external APIs.

```typescript
import { Service, Handler, RestateContext } from 'nestjs-restate';

@Service('notifications')
export class NotificationService {
    constructor(
        private readonly ctx: RestateContext,
        private readonly mailer: MailProvider, // regular NestJS DI
    ) {}

    @Handler()
    async sendWelcome(input: { email: string; name: string }) {
        await this.ctx.run('send-email', () =>
            this.mailer.send(input.email, `Welcome, ${input.name}!`),
        );
    }
}
```

### Virtual Objects

Stateful entities identified by a unique key. Each object instance gets its own key-value store managed by Restate — no external database needed. Exclusive handlers run one-at-a-time per key (consistency), while `@Shared()` handlers can run concurrently (reads).

```typescript
import { VirtualObject, Handler, Shared, RestateContext } from 'nestjs-restate';

@VirtualObject('cart')
export class CartObject {
    constructor(private readonly ctx: RestateContext) {}

    @Handler() // exclusive — only one writer per cart key at a time
    async addItem(item: { sku: string; qty: number }) {
        const items = (await this.ctx.get<CartItem[]>('items')) ?? [];
        items.push(item);
        this.ctx.set('items', items);
        return items;
    }

    @Shared() // concurrent — safe for reads
    async getTotal() {
        const items = (await this.ctx.get<CartItem[]>('items')) ?? [];
        return items.reduce((sum, i) => sum + i.qty * i.price, 0);
    }
}
```

Use virtual objects for: shopping carts, user sessions, chat rooms, rate limiters, or any entity that needs consistent state without a separate database.

### Workflows

Long-running durable processes with a unique execution per key. A workflow has one `@Run()` entry point and can receive external signals via `@Signal()` handlers while it runs.

```typescript
import { Workflow, Run, Signal, Shared, RestateContext, TerminalError } from 'nestjs-restate';

@Workflow('user-signup')
export class SignupWorkflow {
    constructor(private readonly ctx: RestateContext) {}

    @Run()
    async run(input: { email: string }) {
        const code = this.ctx.rand.uuidv4().slice(0, 6);

        await this.ctx.run('send-code', () =>
            mailer.send(input.email, `Your code: ${code}`),
        );

        // Suspends until the user confirms — costs zero compute while waiting
        const submitted = await this.ctx.promise<string>('confirmation');

        if (submitted !== code) {
            throw new TerminalError('Invalid code', { errorCode: 400 });
        }

        await this.ctx.run('activate', () => db.activateUser(input.email));
        return { status: 'verified' };
    }

    @Signal()
    async confirm(code: string) {
        await this.ctx.promise<string>('confirmation').resolve(code);
    }

    @Shared()
    async status() {
        return this.ctx.promise<string>('confirmation')
            .peek()
            .then(() => 'confirmed')
            .catch(() => 'pending');
    }
}
```

Use workflows for: user onboarding, approval flows, order fulfillment, or any multi-step process that needs to wait for external events.

**Key rules:**
- Exactly **one** `@Run()` per workflow — the method **must** be named `run`
- `@Signal()` methods can be called concurrently while the workflow is running

> **`@Signal()` vs `@Shared()` on workflows:** Both are concurrent handlers in the Restate SDK. Use `@Signal()` for methods that receive external input (resolving promises), and `@Shared()` for read-only queries (checking status). The distinction is semantic — they compile to the same handler type.
- Use `this.ctx.promise()` for durable signals between run and signal handlers

### Mental Model

If you know NestJS, you already know 80% of what you need:

| You already know | Restate equivalent | What changes |
|---|---|---|
| `@Injectable()` service | `@Service()` | Handlers are durable — side effects wrapped in `ctx.run()` survive crashes |
| Stateless service + database | `@VirtualObject()` | State lives in Restate's built-in key-value store, not your DB |
| Saga / multi-step job | `@Workflow()` | A durable process with signals, promises, and exactly-once completion |
| `constructor(private svc: MyService)` | `@InjectClient(MyService)` | Type-safe RPC between Restate services via DI |
| HTTP controller calling a service | `@InjectClient()` Ingress | Call Restate services from REST controllers, cron jobs, etc. |
| `@UseGuards()`, `@UseInterceptors()` | Same decorators | Guards, interceptors, pipes, and filters work on handlers automatically |

## Calling Services

### From controllers and other NestJS code (Ingress)

Use the Ingress client to call Restate services from REST controllers, cron jobs, or any NestJS provider. Pass the decorated class directly — no manual SDK definitions needed:

```typescript
import { Controller, Post, Body, Param } from '@nestjs/common';
import { InjectClient, type Ingress } from 'nestjs-restate';
import { PaymentService } from './payment.service';
import { CartObject } from './cart.object';

@Controller('api')
export class ApiController {
    constructor(@InjectClient() private readonly restate: Ingress) {}

    @Post('charge')
    async charge(@Body() body: { userId: string; amount: number }) {
        const client = this.restate.serviceClient(PaymentService);
        return client.charge(body);
    }

    @Post('cart/:key/add')
    async addToCart(@Param('key') key: string, @Body() item: CartItem) {
        const client = this.restate.objectClient(CartObject, key);
        return client.addItem(item);
    }
}
```

The `Ingress` type is re-exported from `nestjs-restate` — pass your decorated classes directly, no manual SDK definitions needed.

If you need a raw SDK-compatible definition (e.g., for use with the SDK's own `Ingress` directly), use the `definitionOf` utilities:

```typescript
import { serviceDefinitionOf, objectDefinitionOf, workflowDefinitionOf } from 'nestjs-restate';

serviceDefinitionOf(PaymentService);     // → { name: 'payments' }
objectDefinitionOf(CartObject);          // → { name: 'cart' }
workflowDefinitionOf(SignupWorkflow);    // → { name: 'user-signup' }
```

### From handler to handler (typed proxies)

Inside a Restate handler, inject a typed proxy to call other services. These calls go through Restate — they're durable, retried on failure, and journaled:

```typescript
import { Service, Handler, InjectClient, RestateContext, type ServiceClient } from 'nestjs-restate';
import { PaymentService } from './payment.service';
import { NotificationService } from './notification.service';

@Service('orders')
export class OrderService {
    constructor(
        private readonly ctx: RestateContext,
        @InjectClient(PaymentService) private readonly payments: ServiceClient<PaymentService>,
        @InjectClient(NotificationService) private readonly notifications: ServiceClient<NotificationService>,
    ) {}

    @Handler()
    async place(input: { userId: string; amount: number }) {
        const receipt = await this.payments.charge(input);
        await this.notifications.sendWelcome({ email: input.userId, name: 'Customer' });
        return receipt;
    }
}
```

Typed proxies use `AsyncLocalStorage` and **only work inside handler methods** (`@Handler()`, `@Run()`, `@Signal()`, `@Shared()`).

For virtual objects, use `ObjectClient<T>`:

```typescript
@InjectClient(CartObject) private readonly cart: ObjectClient<CartObject>
```

For workflows, use `WorkflowClient<T>`:

```typescript
@InjectClient(SignupWorkflow) private readonly signup: WorkflowClient<SignupWorkflow>
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
    ingress: 'http://localhost:8080',
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

## Execution Pipeline

Guards, interceptors, pipes, and exception filters work on Restate handlers automatically — use `@UseGuards()`, `@UseInterceptors()`, `@UseFilters()` the same way you would on a controller.

### Handler Parameter Decorators

Use `@Input()` and `@Ctx()` to inject handler arguments — same pattern as `@Body()` / `@Param()` for HTTP or `@Args()` for GraphQL:

```typescript
@Service('payment')
export class PaymentService {
    constructor(private readonly gateway: PaymentGateway) {}

    @Handler()
    async charge(@Input() input: ChargeRequest) {
        return this.gateway.process(input);
    }

    @Handler()
    async refund(@Input('transactionId') txnId: string, @Ctx() ctx: Context) {
        await ctx.run('refund', () => this.gateway.refund(txnId));
    }
}
```

| Decorator | Description |
|---|---|
| `@Input()` | Handler input (full object) |
| `@Input('property')` | Single property from the input |
| `@Ctx()` | Restate SDK context (`Context`, `ObjectContext`, `WorkflowContext`) |

Handlers without decorators continue to work — `@Input()` is injected automatically as the first parameter when no decorators are present.

### Guards and Interceptors

The handler args follow the RPC convention: `context.switchToRpc().getData()` returns the handler input, `context.switchToRpc().getContext()` returns the Restate SDK context. Use `context.getType()` to distinguish Restate from other context types:

```typescript
@Injectable()
export class AmountLimitGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        if (context.getType() !== 'restate') return true;
        const input = context.switchToRpc().getData();
        return input.amount <= 10_000;
    }
}
```

### RestateExceptionFilter

Maps NestJS HTTP exceptions to Restate semantics — `TerminalError` passes through, 4xx → `TerminalError` (not retried), 5xx/unknown → rethrown (retried). Complementary to `asTerminalError`:

```typescript
@Service('payment')
@UseFilters(RestateExceptionFilter)
export class PaymentService { ... }
```

To disable pipeline features globally, see `pipeline` in [Configuration](#module-options).

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

### Error Formatting

The logger transport automatically adjusts log levels to reduce noise and surface real problems:

| Condition | Original level | Effective level |
|---|---|---|
| `TerminalError` at WARN | WARN | ERROR |
| `RetryableError` / plain `Error` at WARN | WARN | DEBUG |
| `"Invocation suspended"` at INFO | INFO | DEBUG |

Recognized labels: `[TerminalError]`, `[RetryableError]`, `[RestateError]`, `[Error]`.

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
    ingress: 'http://localhost:8080',          // Restate ingress URL (or { url, headers })
    endpoint: { port: 9080 },                 // HTTP/2 endpoint (see Endpoint Modes below)
    admin: 'http://localhost:9070',            // Admin API URL (or { url, authToken })
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
    errors: {                                 // Error formatting in logs (see Logging)
        stackTraces: true,                    // Include stack traces (default: false)
    },
    pipeline: {                               // Execution pipeline (see Execution Pipeline)
        guards: true,                         // Enable guards (default: true)
        interceptors: true,                   // Enable interceptors (default: true)
        filters: true,                        // Enable exception filters (default: true)
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

### Restate Cloud

When using [Restate Cloud](https://restate.dev/cloud/), admin and ingress API calls require authentication:

```typescript
RestateModule.forRoot({
    ingress: {
        url: process.env.RESTATE_INGRESS_URL,
        headers: { Authorization: `Bearer ${process.env.RESTATE_AUTH_TOKEN}` },
    },
    admin: {
        url: process.env.RESTATE_ADMIN_URL,
        authToken: process.env.RESTATE_AUTH_TOKEN,
    },
    endpoint: { port: 9080 },
    autoRegister: {
        deploymentUrl: process.env.RESTATE_DEPLOYMENT_URL,
    },
})
```

| Option | Purpose | Affects |
|--------|---------|--------|
| `ingress.headers` | Custom headers for ingress client | All service/object/workflow client calls |
| `admin.authToken` | Bearer token for Restate admin API | `autoRegister` deployment registration |

Both `ingress` and `admin` also accept a plain URL string for non-authenticated setups.

To obtain your authentication token, log in via the [Restate Cloud dashboard](https://cloud.restate.dev) or run `restate cloud login` with the [Restate CLI](https://docs.restate.dev/references/cli).

### Component-Level Options

Decorators accept a string name, an options object, or nothing at all — omitting the name defaults it to the class name:

```typescript
@Service()                          // name → 'PaymentService'
export class PaymentService { ... }
```

For fine-grained SDK configuration, pass an options object:

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

#### Registration Mode

By default, auto-registration uses `force: true` (development mode) — every restart overwrites the existing deployment. For production, use `mode: 'production'` to skip registration when the interface hasn't changed:

```typescript
autoRegister: {
    deploymentUrl: 'http://my-service.default:9080',
    mode: 'production',        // GET pre-check + hash comparison
    metadata: { version: '2.1.0' },  // custom metadata sent with deployment
},
```

| Mode | Behavior |
|---|---|
| `'development'` (default) | Always registers with `force: true` — safe for local dev |
| `'production'` | Computes a SHA-256 hash of the service interface. If the deployment already exists with the same hash, registration is skipped entirely — zero unnecessary writes to Restate. |

The hash is stored as `nestjs-restate.interface-hash` in the deployment metadata and can be inspected via the Restate admin API.

## API Reference

### Decorators

All class decorators implicitly apply `@Injectable()`.

| Decorator | Description |
|---|---|
| `@Service(name?)` | [Restate Service](https://docs.restate.dev/develop/ts/services) — stateless durable handlers. Name defaults to the class name when omitted. |
| `@VirtualObject(name?)` | [Restate Virtual Object](https://docs.restate.dev/develop/ts/services#virtual-objects) — keyed stateful handlers. Name defaults to the class name when omitted. |
| `@Workflow(name?)` | [Restate Workflow](https://docs.restate.dev/develop/ts/services#workflows) — long-running durable process. Name defaults to the class name when omitted. |
| `@Handler()` | Handler method on `@Service`, or exclusive handler on `@VirtualObject` |
| `@Shared()` | Concurrent handler on `@VirtualObject` (for reads that can run in parallel) |
| `@Signal()` | Signal handler on `@Workflow` (receives external signals while the workflow runs) |
| `@Run()` | Entry point of a `@Workflow` (exactly one per workflow) |
| `@InjectClient()` | Injects the enhanced `Ingress` client — accepts decorated classes directly (for use outside handler context) |
| `@InjectClient(ServiceClass)` | Injects a typed service proxy (handler context only — uses AsyncLocalStorage) |

| Injectable | Description |
|---|---|
| `RestateContext` | Injectable wrapper around the Restate SDK context — automatically scoped to the current request via `AsyncLocalStorage` |

Component and handler decorators also accept an optional options object for SDK-level configuration — see [Configuration](#configuration).

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

For service-to-service calls, use `@InjectClient()` with typed proxies instead of `ctx.serviceClient()`. See [Calling Services](#from-handler-to-handler-typed-proxies).

### Pipeline

| Export | Description |
|---|---|
| `Input()` | Parameter decorator — injects handler input (or a single property with `@Input('prop')`) |
| `Ctx()` | Parameter decorator — injects the Restate SDK context |
| `RestateExceptionFilter` | Exception filter — 4xx `HttpException` → `TerminalError`, 5xx/unknown → rethrown |
| `RestateExecutionContext` | Typed wrapper with `getInput()` / `getRestateContext()` — alternative to `switchToRpc()` |
| `RestateContextType` | String literal `'restate'` — returned by `context.getType()` |
| `PipelineOptions` | Configuration type for the `pipeline` module option |

## Migrating from v1

See [MIGRATION.md](MIGRATION.md) for a complete migration guide with before/after examples.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commands, and guidelines.

## License

[MIT](LICENSE)
