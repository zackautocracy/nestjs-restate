// Re-export commonly used Restate SDK types for convenience
export type {
    Context,
    ContextDate,
    DefaultServiceOptions,
    DurablePromise,
    Duration,
    GenericCall,
    GenericSend,
    InvocationHandle,
    InvocationId,
    InvocationPromise,
    LoggerContext,
    LoggerTransport,
    LogMetadata,
    ObjectContext,
    ObjectHandlerOpts,
    ObjectOptions,
    ObjectSharedContext,
    Rand,
    Request,
    RetryPolicy,
    RunAction,
    RunOptions,
    Serde,
    ServiceHandlerOpts,
    ServiceOptions,
    WorkflowContext,
    WorkflowHandlerOpts,
    WorkflowOptions,
    WorkflowSharedContext,
} from "@restatedev/restate-sdk";
// Error classes — re-exported for convenience
export {
    CancelledError,
    InvocationIdParser,
    RestateError,
    RestatePromise,
    RetryableError,
    rpc,
    SendOpts,
    serde,
    TerminalError,
    TimeoutError,
} from "@restatedev/restate-sdk";
// Context
export { RestateContext } from "./context/restate-context";
export { getContextIfAvailable, getCurrentContext } from "./context/restate-context.store";
export {
    Handler,
    InjectClient,
    Run,
    Service,
    Shared,
    Signal,
    VirtualObject,
    Workflow,
} from "./decorators";
// Definition utilities
export {
    objectDefinitionOf,
    serviceDefinitionOf,
    workflowDefinitionOf,
} from "./ingress/definition-of";
// Ingress (enhanced)
export type {
    Constructor,
    Ingress,
    IngressObjectClient,
    IngressSendObjectClient,
    IngressSendServiceClient,
    IngressServiceClient,
    IngressWorkflowClient,
} from "./ingress/restate-ingress";
export { createRestateIngress } from "./ingress/restate-ingress";
// Logging
export { RestateLoggerService } from "./logging/restate-logger.service";
export { createRestateLoggerTransport } from "./logging/restate-logger.transport";
// Proxy types
export type {
    HandlerMethods,
    ObjectClient,
    ServiceClient,
    WorkflowClient,
} from "./proxy/client-proxy";
export { getClientToken } from "./proxy/client-token";
// Component metadata (shared utility)
export type { ComponentMeta } from "./registry/component-metadata";
export { getComponentMeta, isRestateComponent } from "./registry/component-metadata";

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
