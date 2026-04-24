import { Logger } from "@nestjs/common";
import type {
    Opts,
    Output,
    Ingress as SdkIngress,
    Send,
    SendOpts,
    WorkflowSubmission,
} from "@restatedev/restate-sdk-clients";

import { getContextIfAvailable } from "../context/restate-context.store.js";
import { getComponentMeta, isRestateComponent } from "../registry/component-metadata.js";

// ── Helper Types ──

/** Class constructor type */
export type Constructor<T = any> = new (...args: any[]) => T;

/** NestJS lifecycle methods to exclude from handler maps */
type NestLifecycleMethods =
    | "onModuleInit"
    | "onModuleDestroy"
    | "onApplicationBootstrap"
    | "onApplicationShutdown"
    | "beforeApplicationShutdown";

/**
 * Filter to only public async methods, excluding NestJS lifecycle hooks.
 * Redefined here (also exists in client-proxy.ts) to avoid circular dependencies.
 */
type HandlerMethods<T> = {
    [K in keyof T as K extends NestLifecycleMethods
        ? never
        : T[K] extends (...args: any[]) => Promise<any>
          ? K
          : never]: T[K];
};

/** Infer the first argument type from a parameter list */
type InferArgType<P extends unknown[]> = P extends [infer A, ...unknown[]] ? A : unknown;

// ── Ingress Client Types for Class-Based Usage ──

/**
 * Typed service client derived from NestJS class methods.
 * Maps each handler method to a callable signature with optional {@link Opts} appended.
 *
 * Unlike the SDK's {@link import("@restatedev/restate-sdk-clients").IngressClient | IngressClient},
 * this does NOT strip the first argument because NestJS class methods don't have
 * a `ctx` first parameter — the context is injected by the framework.
 */
export type IngressServiceClient<T> = {
    [K in keyof HandlerMethods<T>]: T[K] extends (...args: infer P) => Promise<infer O>
        ? (...args: [...P, opts?: Opts<InferArgType<P>, O>]) => Promise<O>
        : never;
};

/** Same shape as {@link IngressServiceClient} — object methods have the same callable signature. */
export type IngressObjectClient<T> = IngressServiceClient<T>;

/**
 * Workflow client: handler methods + `workflowSubmit` / `workflowAttach` / `workflowOutput`,
 * minus `run` (which is submitted via `workflowSubmit`).
 */
export type IngressWorkflowClient<T> = Omit<
    IngressServiceClient<T> & {
        /** Submit the workflow's `run` handler for asynchronous execution. */
        workflowSubmit: T extends { run: (...args: infer P) => Promise<infer O> }
            ? (...args: [...P, opts?: SendOpts<InferArgType<P>>]) => Promise<WorkflowSubmission<O>>
            : never;
        /** Attach to the workflow and wait for completion. */
        workflowAttach: T extends { run: (...args: any[]) => Promise<infer O> }
            ? (opts?: Opts<void, O>) => Promise<O>
            : never;
        /** Check if the workflow output is ready without waiting for completion. */
        workflowOutput: T extends { run: (...args: any[]) => Promise<infer O> }
            ? (opts?: Opts<void, O>) => Promise<Output<O>>
            : never;
    },
    "run"
>;

/** Fire-and-forget service client — returns {@link Send} instead of the handler result. */
export type IngressSendServiceClient<T> = {
    [K in keyof HandlerMethods<T>]: T[K] extends (...args: infer P) => Promise<infer O>
        ? (...args: [...P, opts?: SendOpts<InferArgType<P>>]) => Promise<Send<O>>
        : never;
};

/** Same shape as {@link IngressSendServiceClient} for virtual objects. */
export type IngressSendObjectClient<T> = IngressSendServiceClient<T>;

// ── Enhanced Ingress Interface ──

/** Methods intercepted by the enhanced Ingress — omitted from base to prevent type conflicts. */
type InterceptedMethods =
    | "serviceClient"
    | "objectClient"
    | "workflowClient"
    | "serviceSendClient"
    | "objectSendClient";

/**
 * Enhanced Ingress interface that extends the SDK's Ingress with overloads
 * accepting NestJS decorated class constructors.
 *
 * This allows using decorated classes directly instead of manually creating
 * SDK definition stubs:
 *
 * ```ts
 * // Before: manual SDK definition stub
 * const def = restate.service({ name: "payment", handlers: { ... } });
 * ingress.serviceClient(def).charge({ amount: 100 });
 *
 * // After: pass the decorated class directly
 * ingress.serviceClient(PaymentService).charge({ amount: 100 });
 * ```
 *
 * Non-intercepted SDK methods (`resolveAwakeable`, `rejectAwakeable`, `result`)
 * are inherited from the base `Ingress` interface via `extends Omit<...>`.
 *
 * SDK definition-based overloads are replaced with class-based overloads.
 * Use `serviceDefinitionOf()` / `objectDefinitionOf()` / `workflowDefinitionOf()`
 * if you need to pass an SDK definition to a method that expects one.
 */
export interface Ingress extends Omit<SdkIngress, InterceptedMethods> {
    /** Create a typed client for a decorated `@Service()` class. */
    serviceClient<T>(target: Constructor<T>): IngressServiceClient<T>;
    /** Create a typed client for a decorated `@VirtualObject()` class, keyed by `key`. */
    objectClient<T>(target: Constructor<T>, key: string): IngressObjectClient<T>;
    /** Create a typed client for a decorated `@Workflow()` class, keyed by `key`. */
    workflowClient<T>(target: Constructor<T>, key: string): IngressWorkflowClient<T>;
    /** Create a fire-and-forget client for a decorated `@Service()` class. */
    serviceSendClient<T>(target: Constructor<T>): IngressSendServiceClient<T>;
    /** Create a fire-and-forget client for a decorated `@VirtualObject()` class, keyed by `key`. */
    objectSendClient<T>(target: Constructor<T>, key: string): IngressSendObjectClient<T>;
}

// ── Runtime Implementation ──

const INTERCEPTED_METHODS = new Set([
    "serviceClient",
    "objectClient",
    "workflowClient",
    "serviceSendClient",
    "objectSendClient",
]);

const EXPECTED_COMPONENT_TYPE: Record<string, string> = {
    serviceClient: "service",
    serviceSendClient: "service",
    objectClient: "object",
    objectSendClient: "object",
    workflowClient: "workflow",
};

const warnedTargets = new Set<string>();

function warnIfInsideHandler(targetName: string, className?: string): void {
    if (getContextIfAvailable() && !warnedTargets.has(targetName)) {
        warnedTargets.add(targetName);
        const ref = className ?? targetName;
        Logger.warn(
            `Ingress client used inside a Restate handler for '${targetName}'. ` +
                `This makes a regular HTTP call and bypasses durable execution. ` +
                `Use @InjectClient(${ref}) for durable RPC instead.`,
            "RestateIngress",
        );
    }
}

/** Wrap a raw SDK Ingress client with class-based overloads. */
export function createRestateIngress(sdkIngress: SdkIngress): Ingress {
    return new Proxy(sdkIngress as unknown as Ingress, {
        get(target: any, prop: string | symbol) {
            if (typeof prop === "symbol" || !INTERCEPTED_METHODS.has(prop)) {
                const val = target[prop];
                return typeof val === "function" ? val.bind(target) : val;
            }
            return (...args: any[]) => {
                const firstArg = args[0];
                if (typeof firstArg === "function" && !isRestateComponent(firstArg)) {
                    const className = firstArg.name || "<anonymous>";
                    throw new Error(
                        `Class '${className}' has no Restate component decorator. ` +
                            `Add @Service(), @VirtualObject(), or @Workflow(), ` +
                            `or pass an SDK definition object.`,
                    );
                }
                if (isRestateComponent(firstArg)) {
                    const meta = getComponentMeta(firstArg);
                    const expectedType = EXPECTED_COMPONENT_TYPE[prop];
                    if (meta.type !== expectedType) {
                        const a = (w: string) => (w === "object" ? "an" : "a");
                        throw new Error(
                            `Method '${prop}' expects ${a(expectedType)} ${expectedType} component, ` +
                                `but '${meta.name}' is ${a(meta.type)} ${meta.type} component.`,
                        );
                    }
                    warnIfInsideHandler(meta.name, firstArg.name);
                    args[0] = { name: meta.name };
                }
                return target[prop](...args);
            };
        },
    });
}

/** @internal — for test isolation only */
export function clearIngressWarnings(): void {
    warnedTargets.clear();
}
