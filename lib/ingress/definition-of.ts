import { getComponentMeta } from "../registry/component-metadata";
import type { Constructor } from "./restate-ingress";

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
