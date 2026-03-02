// Re-export commonly used Restate SDK types for convenience
export type {
    Context,
    DefaultServiceOptions,
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
export { Handler, InjectClient, Run, Service, Shared, VirtualObject, Workflow } from "./decorators";

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
