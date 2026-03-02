// Decorators

// Re-export commonly used Restate SDK types for convenience
export type {
    Context,
    ObjectContext,
    ObjectSharedContext,
    WorkflowContext,
    WorkflowSharedContext,
} from "@restatedev/restate-sdk";
export { Handler, InjectClient, Run, Service, Shared, VirtualObject, Workflow } from "./decorators";

// Constants (for advanced usage)
export { RESTATE_CLIENT, RESTATE_ENDPOINT } from "./restate.constants";

// Types
export type {
    EndpointConfig,
    RestateModuleAsyncOptions,
    RestateModuleOptions,
} from "./restate.interfaces";
// Module
export { RestateModule } from "./restate.module";
