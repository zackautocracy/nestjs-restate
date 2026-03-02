import type { InvocationHandle, SendOpts } from "@restatedev/restate-sdk";
import { getCurrentContext } from "../context/restate-context.store";
import {
    SERVICE_METADATA_KEY,
    VIRTUAL_OBJECT_METADATA_KEY,
    WORKFLOW_METADATA_KEY,
} from "../restate.constants";

// ── Proxy Types ──

type NestLifecycleMethods =
    | "onModuleInit"
    | "onModuleDestroy"
    | "onApplicationBootstrap"
    | "onApplicationShutdown"
    | "beforeApplicationShutdown";

export type HandlerMethods<T> = {
    [K in keyof T as K extends NestLifecycleMethods
        ? never
        : T[K] extends (...args: any[]) => Promise<any>
          ? K
          : never]: T[K];
};

type InferArg<P> = P extends [infer A, ...any[]] ? A : unknown;

type SendProxy<T> = {
    [K in keyof T]: T[K] extends (...args: infer P) => any
        ? (...args: [...P, opts?: SendOpts<InferArg<P>>]) => InvocationHandle
        : never;
};

export type ServiceClient<T> = Omit<HandlerMethods<T>, "send"> & {
    readonly send: SendProxy<HandlerMethods<T>>;
};

export type ObjectClient<T> = {
    key(objectKey: string): Omit<HandlerMethods<T>, "send"> & {
        readonly send: SendProxy<HandlerMethods<T>>;
    };
};

export type WorkflowClient<T> = {
    key(workflowId: string): Omit<HandlerMethods<T>, "send"> & {
        readonly send: SendProxy<HandlerMethods<T>>;
    };
};

// ── Proxy Factory ──

const PASSTHROUGH_PROPS = new Set(["then", "catch", "finally", "toJSON", "valueOf"]);

function createMethodProxy(getClient: (ctx: any) => any, getSendClient: (ctx: any) => any): any {
    const sendProxy = new Proxy({} as any, {
        get(_, methodName: string | symbol) {
            if (typeof methodName === "symbol" || PASSTHROUGH_PROPS.has(methodName))
                return undefined;
            return (...args: any[]) => {
                const ctx = getCurrentContext();
                return getSendClient(ctx)[methodName](...args);
            };
        },
    });

    return new Proxy({} as any, {
        get(_, methodName: string | symbol) {
            if (typeof methodName === "symbol" || PASSTHROUGH_PROPS.has(methodName))
                return undefined;
            if (methodName === "send") return sendProxy;
            return (...args: any[]) => {
                const ctx = getCurrentContext();
                return getClient(ctx)[methodName](...args);
            };
        },
    });
}

function getComponentMeta(target: any): { type: "service" | "object" | "workflow"; name: string } {
    const svc = Reflect.getMetadata(SERVICE_METADATA_KEY, target);
    if (svc) return { type: "service", name: svc.name };
    const obj = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, target);
    if (obj) return { type: "object", name: obj.name };
    const wf = Reflect.getMetadata(WORKFLOW_METADATA_KEY, target);
    if (wf) return { type: "workflow", name: wf.name };
    throw new Error(
        `${target.name} has no Restate component decorator. ` +
            `Add @Service(), @VirtualObject(), or @Workflow() to use it with @InjectClient().`,
    );
}

export function createClientProxy(target: any): any {
    const { type, name } = getComponentMeta(target);

    if (type === "service") {
        return createMethodProxy(
            (ctx) => ctx.serviceClient({ name }),
            (ctx) => ctx.serviceSendClient({ name }),
        );
    }

    // Objects and workflows use the key() factory pattern
    const keyedProxy = {
        key(keyValue: string) {
            if (type === "object") {
                return createMethodProxy(
                    (ctx) => ctx.objectClient({ name }, keyValue),
                    (ctx) => ctx.objectSendClient({ name }, keyValue),
                );
            }
            return createMethodProxy(
                (ctx) => ctx.workflowClient({ name }, keyValue),
                (ctx) => ctx.workflowSendClient({ name }, keyValue),
            );
        },
    };

    // Guard the key-based proxy object against thenable detection too
    return new Proxy(keyedProxy, {
        get(target, prop: string | symbol) {
            if (typeof prop === "symbol" || PASSTHROUGH_PROPS.has(prop)) return undefined;
            return (target as any)[prop];
        },
    });
}
