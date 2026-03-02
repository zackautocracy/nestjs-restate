import { Injectable } from "@nestjs/common";
import { registerComponent } from "../registry/component-registry";
import { SERVICE_METADATA_KEY } from "../restate.constants";
import type { ServiceComponentMetadata, ServiceDecoratorOptions } from "../restate.interfaces";

/**
 * Marks a class as a Restate service.
 *
 * @param nameOrOptions - Service name string or full options object.
 * @example
 * ```ts
 * @Service('payments')
 * // or
 * @Service({ name: 'payments', options: { retryPolicy: { maxAttempts: 5 } } })
 * ```
 */
export function Service(nameOrOptions: ServiceDecoratorOptions): ClassDecorator {
    const meta: ServiceComponentMetadata =
        typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions;

    return (target) => {
        Injectable()(target as unknown as new (...args: any[]) => any);
        Reflect.defineMetadata(SERVICE_METADATA_KEY, meta, target);
        registerComponent(target as unknown as new (...args: any[]) => any);
    };
}
