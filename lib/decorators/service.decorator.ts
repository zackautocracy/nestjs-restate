import { Injectable } from "@nestjs/common";
import { registerComponent } from "../registry/component-registry";
import { SERVICE_METADATA_KEY } from "../restate.constants";
import type {
    ResolvedServiceComponentMetadata,
    ServiceComponentMetadata,
    ServiceDecoratorOptions,
} from "../restate.interfaces";

/**
 * Marks a class as a Restate service.
 *
 * @param nameOrOptions - Service name string, full options object, or omitted to use the class name.
 * @example
 * ```ts
 * @Service('payments')
 * // or
 * @Service({ name: 'payments', options: { retryPolicy: { maxAttempts: 5 } } })
 * // or
 * @Service() // uses class name
 * ```
 */
export function Service(nameOrOptions?: ServiceDecoratorOptions): ClassDecorator {
    return (target) => {
        const meta: ServiceComponentMetadata =
            typeof nameOrOptions === "string" ? { name: nameOrOptions } : (nameOrOptions ?? {});

        // Default name to class name if not provided
        if (!meta.name) {
            meta.name = (target as any).name;
        }

        Injectable()(target as unknown as new (...args: any[]) => any);
        Reflect.defineMetadata(
            SERVICE_METADATA_KEY,
            meta as ResolvedServiceComponentMetadata,
            target,
        );
        registerComponent(target as unknown as new (...args: any[]) => any);
    };
}
