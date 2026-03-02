import { Injectable } from "@nestjs/common";
import type {
    Context,
    DurablePromise,
    Duration,
    ObjectContext,
    ObjectSharedContext,
    Rand,
    RestatePromise,
    RunAction,
    RunOptions,
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

    sleep(duration: Duration): Promise<void> {
        return this.ctx.sleep(duration);
    }

    // ── External events ──

    awakeable<T>(): { id: string; promise: Promise<T> } {
        return this.ctx.awakeable();
    }

    resolveAwakeable<T>(id: string, value: T): void {
        this.ctx.resolveAwakeable(id, value);
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
