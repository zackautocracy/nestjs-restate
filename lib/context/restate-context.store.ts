import { AsyncLocalStorage } from "node:async_hooks";

const contextStore = new AsyncLocalStorage<any>();

export function runWithContext<T>(ctx: any, fn: () => T): T {
    return contextStore.run(ctx, fn);
}

export function getCurrentContext<T = any>(): T {
    const ctx = contextStore.getStore();
    if (!ctx) {
        throw new Error(
            "Restate context not available. " +
                "This can only be used within @Handler/@Run/@Signal/@Shared methods. " +
                "To call Restate services from outside handlers (e.g., REST controllers), " +
                "use @InjectClient() (no args) for the Restate Ingress client instead.",
        );
    }
    return ctx;
}
