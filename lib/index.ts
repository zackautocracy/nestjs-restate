// Re-export commonly used Restate SDK types for convenience
export type {
    Context,
    DefaultServiceOptions,
    DurablePromise,
    Duration,
    InvocationHandle,
    ObjectContext,
    ObjectHandlerOpts,
    ObjectOptions,
    ObjectSharedContext,
    RetryPolicy,
    ServiceHandlerOpts,
    ServiceOptions,
    WorkflowContext,
    WorkflowHandlerOpts,
    WorkflowOptions,
    WorkflowSharedContext,
} from "@restatedev/restate-sdk";
export { rpc, SendOpts } from "@restatedev/restate-sdk";
// Context
export { RestateContext } from "./context/restate-context";
export { getCurrentContext } from "./context/restate-context.store";
export { Handler, InjectClient, Run, Service, Shared, VirtualObject, Workflow } from "./decorators";

// Proxy types
export type {
    HandlerMethods,
    ObjectClient,
    ServiceClient,
    WorkflowClient,
} from "./proxy/client-proxy";
export { getClientToken } from "./proxy/client-token";

// Constants (for advanced usage)
export { RESTATE_CLIENT } from "./restate.constants";

// Types
export type {
    AnyHandlerOpts,
    AutoRegisterOptions,
    EndpointConfig,
    RestateModuleAsyncOptions,
    RestateModuleOptions,
    ServiceComponentMetadata,
    ServiceDecoratorOptions,
    VirtualObjectComponentMetadata,
    VirtualObjectDecoratorOptions,
    WorkflowComponentMetadata,
    WorkflowDecoratorOptions,
} from "./restate.interfaces";

// Module
export { RestateModule } from "./restate.module";
