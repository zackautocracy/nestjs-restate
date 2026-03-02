import { HANDLER_METADATA_KEY } from "../restate.constants";
import type { AnyHandlerOpts, HandlerMetadata, HandlerType } from "../restate.interfaces";

function createHandlerDecorator(type: HandlerType): (options?: AnyHandlerOpts) => MethodDecorator {
    return (options?: AnyHandlerOpts) => {
        return (target: object, propertyKey: string | symbol) => {
            const ctor = target.constructor;
            const existing: HandlerMetadata[] =
                Reflect.getMetadata(HANDLER_METADATA_KEY, ctor) || [];

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

/** Marks a shared handler on a @Workflow or @VirtualObject (for signals and queries). */
export const Shared = createHandlerDecorator("shared");
