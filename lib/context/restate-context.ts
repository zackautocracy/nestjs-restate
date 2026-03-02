import { Injectable } from "@nestjs/common";
import type {
    Context,
    ContextDate,
    DurablePromise,
    Duration,
    GenericCall,
    GenericSend,
    InvocationHandle,
    InvocationId,
    InvocationPromise,
    ObjectContext,
    ObjectSharedContext,
    Rand,
    Request,
    RestatePromise,
    RunAction,
    RunOptions,
    Serde,
    WorkflowContext,
    WorkflowSharedContext,
} from "@restatedev/restate-sdk";
import { getCurrentContext } from "./restate-context.store";

@Injectable()
export class RestateContext {
    private get ctx(): any {
        return getCurrentContext();
    }

    // ── Durable execution ──

    run<T>(action: RunAction<T>): RestatePromise<T>;
    run<T>(name: string, action: RunAction<T>): RestatePromise<T>;
    run<T>(name: string, action: RunAction<T>, options: RunOptions<T>): RestatePromise<T>;
    run<T>(...args: unknown[]): RestatePromise<T> {
        return this.ctx.run(...args);
    }

    sleep(duration: Duration | number, name?: string): RestatePromise<void> {
        if (name !== undefined) {
            return this.ctx.sleep(duration, name);
        }
        return this.ctx.sleep(duration);
    }

    // ── External events ──

    awakeable<T>(serde?: Serde<T>): { id: string; promise: RestatePromise<T> } {
        if (serde !== undefined) {
            return this.ctx.awakeable(serde);
        }
        return this.ctx.awakeable();
    }

    resolveAwakeable<T>(id: string, payload?: T, serde?: Serde<T>): void {
        if (serde !== undefined) {
            this.ctx.resolveAwakeable(id, payload, serde);
        } else if (payload !== undefined) {
            this.ctx.resolveAwakeable(id, payload);
        } else {
            this.ctx.resolveAwakeable(id);
        }
    }

    rejectAwakeable(id: string, reason: string): void {
        this.ctx.rejectAwakeable(id, reason);
    }

    // ── Random ──

    get rand(): Rand {
        return this.ctx.rand;
    }

    // ── State (ObjectContext/WorkflowContext only — throws otherwise) ──

    get<T>(key: string): Promise<T | null> {
        return this.ctx.get(key);
    }

    set<T>(key: string, value: T): void {
        this.ctx.set(key, value);
    }

    clear(key: string): void {
        this.ctx.clear(key);
    }

    clearAll(): void {
        this.ctx.clearAll();
    }

    stateKeys(): Promise<string[]> {
        return this.ctx.stateKeys();
    }

    // ── Workflow durable promises (WorkflowContext/WorkflowSharedContext only) ──

    promise<T>(name: string): DurablePromise<T> {
        return this.ctx.promise(name);
    }

    // ── Object key (VirtualObject/Workflow only — throws otherwise) ──

    get key(): string {
        return this.ctx.key;
    }

    // ── Logging (context-aware, automatically muted during replay) ──

    get console(): Console {
        return this.ctx.console;
    }

    // ── Deterministic date ──

    get date(): ContextDate {
        return this.ctx.date;
    }

    // ── Invocation management ──

    request(): Request {
        return this.ctx.request();
    }

    cancel(invocationId: InvocationId): void {
        this.ctx.cancel(invocationId);
    }

    attach<T>(invocationId: InvocationId, serde?: Serde<T>): RestatePromise<T> {
        if (serde !== undefined) {
            return this.ctx.attach(invocationId, serde);
        }
        return this.ctx.attach(invocationId);
    }

    // ── Generic calls (untyped service invocation) ──

    genericCall<REQ = Uint8Array, RES = Uint8Array>(
        call: GenericCall<REQ, RES>,
    ): InvocationPromise<RES> {
        return this.ctx.genericCall(call);
    }

    genericSend<REQ = Uint8Array>(call: GenericSend<REQ>): InvocationHandle {
        return this.ctx.genericSend(call);
    }

    // ── Raw SDK context (escape hatch) ──

    get raw():
        | Context
        | ObjectContext
        | ObjectSharedContext
        | WorkflowContext
        | WorkflowSharedContext {
        return this.ctx;
    }
}
