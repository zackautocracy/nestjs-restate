# Migration Guide: v1 → v2

v2 uses dependency injection for context, typed service proxies, and separate decorators for workflow signals vs virtual object shared handlers.

## Breaking Changes

| Area | v1 | v2 |
|---|---|---|
| Handler signature | `greet(ctx: Context, name: string)` | `greet(name: string)` |
| Context access | SDK context as first parameter | `RestateContext` via constructor DI |
| Inter-service calls | Manual `Ingress` client | `@InjectClient(ServiceClass)` typed proxies |
| Workflow signals | `@Shared()` | `@Signal()` |
| Error imports | `from '@restatedev/restate-sdk'` | `from 'nestjs-restate'` (optional) |

## Handler Signatures

Remove `ctx` from handler parameters. Inject `RestateContext` via constructor instead:

```diff
-import type { Context } from '@restatedev/restate-sdk';
+import { RestateContext } from 'nestjs-restate';

 @Service('greeter')
 export class GreeterService {
+    constructor(private readonly ctx: RestateContext) {}
+
     @Handler()
-    async greet(ctx: Context, name: string) {
-        return await ctx.run('greeting', () => `Hello, ${name}!`);
+    async greet(name: string) {
+        return await this.ctx.run('greeting', () => `Hello, ${name}!`);
     }
 }
```

`RestateContext` uses `AsyncLocalStorage` to resolve the correct per-request SDK context automatically.

## Service-to-Service Calls

**Inside handlers** — use typed proxies (auto-discovered, full type safety):

```diff
-constructor(@InjectClient() private readonly restate: Ingress) {}
-
-async call() {
-    const client = this.restate.serviceClient<GreeterService>({ name: 'greeter' });
-    return client.greet('world');
-}
+constructor(
+    @InjectClient(GreeterService) private readonly greeter: ServiceClient<GreeterService>,
+) {}
+
+@Handler()
+async call() {
+    return this.greeter.greet('world');
+}
```

Three proxy types: `ServiceClient<T>`, `ObjectClient<T>` (`.key()`), `WorkflowClient<T>` (`.key()`).

**Outside handlers** (controllers, etc.) — `@InjectClient()` (no args) still injects the `Ingress` client, unchanged from v1.

## Workflow Signals

`@Shared()` handlers on workflows are now reserved for concurrent read operations (e.g., status queries). Use `@Signal()` for handlers that receive external events and resolve workflow promises. Both decorators are valid on workflows and map to the same SDK handler type (`workflow.shared`), but communicate different intent.

```diff
-import { Workflow, Run, Shared } from 'nestjs-restate';
+import { Workflow, Run, Signal, RestateContext } from 'nestjs-restate';

 @Workflow('payment')
 export class PaymentWorkflow {
+    constructor(private readonly ctx: RestateContext) {}
+
     @Run()
-    async run(ctx: WorkflowContext, input: PaymentRequest) { ... }
+    async run(input: PaymentRequest) { ... }

-    @Shared()
-    async confirm(ctx: WorkflowSharedContext, input: { id: string }) { ... }
+    @Signal()
+    async confirm(input: { id: string }) { ... }
 }
```

## Checklist

- [ ] Update `@restatedev/restate-sdk-clients` to `>=1.8.0`
- [ ] Add `RestateContext` to constructor of all handler classes
- [ ] Remove `ctx` parameter from all handler methods — use `this.ctx`
- [ ] Rename `@Shared()` → `@Signal()` on workflow handlers that resolve promises; keep `@Shared()` for read-only query handlers
- [ ] Replace manual `serviceClient()` with `@InjectClient(T)` typed proxies
- [ ] Update error imports to use `nestjs-restate` (optional but recommended)
- [ ] Run tests to verify everything works
