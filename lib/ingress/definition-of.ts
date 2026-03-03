import { getComponentMeta } from "../registry/component-metadata";
import type { Constructor } from "./restate-ingress";

// ── Handler Map Types (add synthetic ctx for SDK compatibility) ──

/** Transforms class methods to SDK handler shape: adds ctx as first param. */
type HandlerMethods<T> = {
    [K in keyof T as T[K] extends (...args: any[]) => Promise<any> ? K : never]: T[K];
};

type ServiceHandlerMap<T> = {
    [K in keyof HandlerMethods<T>]: T[K] extends (...args: infer P) => Promise<infer O>
        ? (ctx: any, ...args: P) => Promise<O>
        : never;
};

type ObjectHandlerMap<T> = ServiceHandlerMap<T>;
type WorkflowHandlerMap<T> = ServiceHandlerMap<T>;

// ── Factory Functions ──

/**
 * Create an SDK-compatible service definition from a `@Service()` decorated class.
 *
 * Use as an escape hatch when you need to pass an SDK definition to a method
 * that doesn't accept NestJS class constructors directly.
 *
 * @example
 * ```ts
 * const def = serviceDefinitionOf(PaymentService);
 * ingress.serviceClient(def);
 * ```
 */
export function serviceDefinitionOf<T>(target: Constructor<T>): { name: string } {
    const { name } = getComponentMeta(target);
    return { name };
}

/**
 * Create an SDK-compatible virtual object definition from a `@VirtualObject()` decorated class.
 *
 * @example
 * ```ts
 * const def = objectDefinitionOf(CartObject);
 * ingress.objectClient(def, key);
 * ```
 */
export function objectDefinitionOf<T>(target: Constructor<T>): { name: string } {
    const { name } = getComponentMeta(target);
    return { name };
}

/**
 * Create an SDK-compatible workflow definition from a `@Workflow()` decorated class.
 *
 * @example
 * ```ts
 * const def = workflowDefinitionOf(OrderWorkflow);
 * ingress.workflowClient(def, key);
 * ```
 */
export function workflowDefinitionOf<T>(target: Constructor<T>): { name: string } {
    const { name } = getComponentMeta(target);
    return { name };
}
