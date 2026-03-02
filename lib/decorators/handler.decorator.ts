import { HANDLER_METADATA_KEY } from "../restate.constants";
import type { AnyHandlerOpts, HandlerMetadata, HandlerType } from "../restate.interfaces";

function createHandlerDecorator(type: HandlerType): (options?: AnyHandlerOpts) => MethodDecorator {
    return (options?: AnyHandlerOpts) => {
        return (target: object, propertyKey: string | symbol) => {
            const ctor = target.constructor;
            // Clone the array to prevent mutating a parent class's metadata
            // when decorating a subclass (Reflect.getMetadata walks the prototype chain).
            const existing: HandlerMetadata[] = [
                ...(Reflect.getMetadata(HANDLER_METADATA_KEY, ctor) || []),
            ];

            existing.push({
                type,
                methodName: propertyKey as string,
                options,
            });

            Reflect.defineMetadata(HANDLER_METADATA_KEY, existing, ctor);
        };
    };
}

/** Marks the main entry point handler of a @Workflow class. Exactly one per workflow. */
export const Run = createHandlerDecorator("run");

/** Marks a handler method on a @Service or exclusive handler on a @VirtualObject. */
export const Handler = createHandlerDecorator("handler");

/** Marks a shared (concurrent) handler on a @VirtualObject — for reads that can run in parallel. */
export const Shared = createHandlerDecorator("shared");

/** Marks a signal handler on a @Workflow — receives external signals while the workflow runs. */
export const Signal = createHandlerDecorator("shared");
