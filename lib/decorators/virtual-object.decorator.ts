import { Injectable } from "@nestjs/common";
import { registerComponent } from "../registry/component-registry";
import { VIRTUAL_OBJECT_METADATA_KEY } from "../restate.constants";
import type {
    ResolvedVirtualObjectComponentMetadata,
    VirtualObjectComponentMetadata,
    VirtualObjectDecoratorOptions,
} from "../restate.interfaces";

/**
 * Marks a class as a Restate virtual object.
 *
 * @param nameOrOptions - Virtual object name string, full options object, or omitted to use the class name.
 * @example
 * ```ts
 * @VirtualObject('cart')
 * // or
 * @VirtualObject({ name: 'cart', options: { enableLazyState: true } })
 * // or
 * @VirtualObject() // uses class name
 * ```
 */
export function VirtualObject(nameOrOptions?: VirtualObjectDecoratorOptions): ClassDecorator {
    return (target) => {
        const meta: VirtualObjectComponentMetadata =
            typeof nameOrOptions === "string"
                ? { name: nameOrOptions }
                : { ...(nameOrOptions ?? {}) };

        // Default name to class name if not provided
        if (!meta.name) {
            meta.name = (target as any).name;
        }

        Injectable()(target as unknown as new (...args: any[]) => any);
        Reflect.defineMetadata(
            VIRTUAL_OBJECT_METADATA_KEY,
            meta as ResolvedVirtualObjectComponentMetadata,
            target,
        );
        registerComponent(target as unknown as new (...args: any[]) => any);
    };
}
