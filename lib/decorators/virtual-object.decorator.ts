import { Injectable } from "@nestjs/common";
import { registerComponent } from "../registry/component-registry";
import { VIRTUAL_OBJECT_METADATA_KEY } from "../restate.constants";
import type {
    VirtualObjectComponentMetadata,
    VirtualObjectDecoratorOptions,
} from "../restate.interfaces";

/**
 * Marks a class as a Restate virtual object.
 *
 * @param nameOrOptions - Virtual object name string or full options object.
 * @example
 * ```ts
 * @VirtualObject('cart')
 * // or
 * @VirtualObject({ name: 'cart', options: { enableLazyState: true } })
 * ```
 */
export function VirtualObject(nameOrOptions: VirtualObjectDecoratorOptions): ClassDecorator {
    const meta: VirtualObjectComponentMetadata =
        typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions;

    return (target) => {
        Injectable()(target as unknown as new (...args: any[]) => any);
        Reflect.defineMetadata(VIRTUAL_OBJECT_METADATA_KEY, meta, target);
        registerComponent(target as unknown as new (...args: any[]) => any);
    };
}
