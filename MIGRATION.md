# Migration Guide: v1 → v2

v2 introduces a NestJS-native developer experience — dependency injection for context, typed service proxies, and separate decorators for workflow signals vs virtual object shared handlers. The underlying Restate SDK is unchanged; only the NestJS integration layer is different.

## Breaking Changes at a Glance

| Area | v1 | v2 |
|---|---|---|
| Handler signature | `greet(ctx: Context, name: string)` | `greet(name: string)` |
| Context access | SDK context as first parameter | `RestateContext` via constructor injection |
| Service calls | `Ingress` client with manual `serviceClient()` | Typed proxies via `@InjectClient(ServiceClass)` |
| Workflow signals | `@Shared()` | `@Signal()` |
| V.O. concurrent handlers | `@Shared()` | `@Shared()` (unchanged) |
| Error handling | `import { TerminalError } from '@restatedev/restate-sdk'` | `import { TerminalError } from 'nestjs-restate'` |

## 1. Handler Signatures

Handlers no longer receive the Restate context as the first argument. Instead, inject `RestateContext` via the constructor.

**Before (v1):**

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

**After (v2):**

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

**What changed:**
- Remove `ctx` from handler parameters — it's now `this.ctx`
- Replace SDK context type imports (`Context`, `ObjectContext`, `WorkflowContext`) with `RestateContext`
- `RestateContext` is a singleton that uses `AsyncLocalStorage` to resolve the correct per-request context automatically

## 2. Service-to-Service Calls

v1 used the Restate `Ingress` client with manual service/object/workflow client construction. v2 introduces typed proxies that are auto-discovered from decorated classes.

**Before (v1):**

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

**After (v2) — from a handler (typed proxy):**

```typescript
import { Service, Handler, InjectClient, type ServiceClient } from 'nestjs-restate';
import { GreeterService } from './greeter.service';

@Service('orchestrator')
export class OrchestratorService {
    constructor(
        @InjectClient(GreeterService) private readonly greeter: ServiceClient<GreeterService>,
    ) {}

    @Handler()
    async orchestrate(name: string) {
        return this.greeter.greet(name);
    }
}
```

**After (v2) — from outside handlers (REST controller, etc.):**

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { InjectClient } from 'nestjs-restate';
import type { Ingress } from '@restatedev/restate-sdk-clients';

@Controller('api')
export class AppController {
    constructor(@InjectClient() private readonly restate: Ingress) {}

    @Post('greet')
    async greet(@Body('name') name: string) {
        const client = this.restate.serviceClient<GreeterService>({ name: 'greeter' });
        return client.greet(name);
    }
}
```

**What changed:**
- `@InjectClient(ServiceClass)` creates a typed proxy (full type safety, no manual client construction)
- Typed proxies only work inside handler methods (`@Handler()`, `@Run()`, `@Signal()`, `@Shared()`)
- `@InjectClient()` (no args) still injects the `Ingress` client for use outside handler context
- Three proxy types: `ServiceClient<T>`, `ObjectClient<T>` (has `.key()`), `WorkflowClient<T>` (has `.key()`)

## 3. Workflow Signals

`@Shared()` on workflows has been renamed to `@Signal()` to better convey intent. `@Shared()` is now exclusively for virtual object concurrent handlers.

**Before (v1):**

```typescript
import { Workflow, Run, Shared } from 'nestjs-restate';

@Workflow('payment')
export class PaymentWorkflow {
    @Run()
    async run(ctx: WorkflowContext, input: PaymentRequest) {
        const confirmation = await ctx.promise<string>('confirmed');
        return { success: true, confirmation };
    }

    @Shared()
    async confirm(ctx: WorkflowSharedContext, input: { id: string }) {
        ctx.promise<string>('confirmed').resolve(input.id);
    }
}
```

**After (v2):**

```typescript
import { Workflow, Run, Signal, RestateContext } from 'nestjs-restate';

@Workflow('payment')
export class PaymentWorkflow {
    constructor(private readonly ctx: RestateContext) {}

    @Run()
    async run(input: PaymentRequest) {
        const confirmation = await this.ctx.promise<string>('confirmed');
        return { success: true, confirmation };
    }

    @Signal()
    async confirm(input: { id: string }) {
        this.ctx.promise<string>('confirmed').resolve(input.id);
    }
}
```

**What changed:**
- `@Shared()` → `@Signal()` on workflow classes
- `@Shared()` remains for virtual object concurrent handlers (unchanged)
- Both decorators produce the same underlying SDK metadata — this is a naming change for clarity

## 4. Virtual Objects

Virtual objects work the same way, but with constructor-injected context.

**Before (v1):**

```typescript
import { VirtualObject, Handler, Shared } from 'nestjs-restate';
import type { ObjectContext, ObjectSharedContext } from '@restatedev/restate-sdk';

@VirtualObject('counter')
export class CounterObject {
    @Handler()
    async increment(ctx: ObjectContext, amount: number) {
        const current = (await ctx.get<number>('count')) ?? 0;
        ctx.set('count', current + amount);
        return current + amount;
    }

    @Shared()
    async getCount(ctx: ObjectSharedContext) {
        return (await ctx.get<number>('count')) ?? 0;
    }
}
```

**After (v2):**

```typescript
import { VirtualObject, Handler, Shared, RestateContext } from 'nestjs-restate';

@VirtualObject('counter')
export class CounterObject {
    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async increment(amount: number) {
        const current = (await this.ctx.get<number>('count')) ?? 0;
        this.ctx.set('count', current + amount);
        return current + amount;
    }

    @Shared()
    async getCount() {
        return (await this.ctx.get<number>('count')) ?? 0;
    }
}
```

## 5. Error Handling

Error classes are now re-exported from `nestjs-restate` for convenience.

**Before (v1):**

```typescript
import { TerminalError } from '@restatedev/restate-sdk';
```

**After (v2):**

```typescript
import { TerminalError } from 'nestjs-restate';
```

Both still work — the v1 import path is not broken, just unnecessary now.

## 6. Module Configuration

Module configuration is largely unchanged. The main addition is that `@restatedev/restate-sdk-clients` peer dependency minimum is now `>=1.8.0`.

```typescript
RestateModule.forRoot({
    ingress: 'http://restate:8080',
    endpoint: { port: 9080 },
    // All other options remain the same
})
```

## Quick Migration Checklist

- [ ] Update `@restatedev/restate-sdk-clients` to `>=1.8.0`
- [ ] Add `RestateContext` to constructor of all handler classes
- [ ] Remove `ctx` parameter from all handler methods — use `this.ctx` instead
- [ ] Remove SDK context type imports (`Context`, `ObjectContext`, `WorkflowContext`, etc.)
- [ ] Replace `@Shared()` with `@Signal()` on `@Workflow` classes
- [ ] Replace manual `serviceClient()`/`objectClient()`/`workflowClient()` with `@InjectClient(ServiceClass)` typed proxies (for handler-to-handler calls)
- [ ] Keep `@InjectClient()` (no args) for REST controllers and non-handler code
- [ ] Update error imports to use `nestjs-restate` (optional but recommended)
- [ ] Run tests to verify everything works
