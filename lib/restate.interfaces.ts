import type { Http2Server } from "node:http2";
import type {
    DefaultServiceOptions,
    ObjectHandlerOpts,
    ObjectOptions,
    ServiceHandlerOpts,
    ServiceOptions,
    WorkflowHandlerOpts,
    WorkflowOptions,
} from "@restatedev/restate-sdk";

/** Union of all handler option types — allows handler decorators to accept any handler-specific options. */
export type AnyHandlerOpts =
    | ServiceHandlerOpts<any, any>
    | ObjectHandlerOpts<any, any>
    | WorkflowHandlerOpts<any, any>;

export interface RestateEndpointPortConfig {
    port: number;
}

export interface RestateEndpointServerConfig {
    server: Http2Server;
}

export interface RestateEndpointLambdaConfig {
    type: "lambda";
}

export type EndpointConfig =
    | RestateEndpointPortConfig
    | RestateEndpointServerConfig
    | RestateEndpointLambdaConfig;

export interface AutoRegisterOptions {
    /** Full URL where Restate server can reach this service endpoint.
     *  Supports `{{port}}` placeholder for random port scenarios (port: 0). */
    deploymentUrl: string;
    /** Force-overwrite existing deployments (default: true) */
    force?: boolean;
}

export interface RestateErrorOptions {
    /** Include stack traces in error log output. Default: `false`. */
    stackTraces?: boolean;
}

export interface RestateModuleOptions {
    /** Restate server ingress URL (e.g., http://restate:8080) */
    ingress: string;
    /** Restate admin URL for auto-registration (e.g., http://restate:9070) */
    admin?: string;
    /** HTTP/2 endpoint configuration */
    endpoint: EndpointConfig;
    /** Auto-register deployment with Restate server on startup */
    autoRegister?: AutoRegisterOptions;
    /**
     * Request identity public keys for validating incoming requests.
     * @example ["publickeyv1_2G8dCQhArfvGpzPw5Vx2ALciR4xCLHfS5YaT93XjNxX9"]
     */
    identityKeys?: string[];
    /**
     * Default service options applied to all services, virtual objects, and workflows.
     * Individual component options override these defaults.
     */
    defaultServiceOptions?: DefaultServiceOptions;
    /** Error formatting options for the logger transport. */
    errors?: RestateErrorOptions;
}

export interface RestateModuleAsyncOptions {
    imports?: any[];
    inject?: any[];
    useFactory: (...args: any[]) => RestateModuleOptions | Promise<RestateModuleOptions>;
}

export type HandlerType = "run" | "handler" | "shared";

// ── Handler metadata ──

export interface HandlerMetadata {
    type: HandlerType;
    methodName: string;
    /** Handler-level SDK options (retryPolicy, timeouts, etc.) */
    options?: AnyHandlerOpts;
}

// ── Component metadata ──

export interface ServiceComponentMetadata {
    name?: string;
    /** Human-readable description shown in admin tools */
    description?: string;
    /** Key/value metadata exposed via the Admin API */
    metadata?: Record<string, string>;
    /** Service-level SDK options (retryPolicy, timeouts, etc.) */
    options?: ServiceOptions;
}

export interface VirtualObjectComponentMetadata {
    name?: string;
    /** Human-readable description shown in admin tools */
    description?: string;
    /** Key/value metadata exposed via the Admin API */
    metadata?: Record<string, string>;
    /** Virtual object SDK options (retryPolicy, timeouts, enableLazyState, etc.) */
    options?: ObjectOptions;
}

export interface WorkflowComponentMetadata {
    name?: string;
    /** Human-readable description shown in admin tools */
    description?: string;
    /** Key/value metadata exposed via the Admin API */
    metadata?: Record<string, string>;
    /** Workflow SDK options (retryPolicy, timeouts, workflowRetention, etc.) */
    options?: WorkflowOptions;
}

// ── Resolved metadata types (name guaranteed after decoration) ──

export interface ResolvedServiceComponentMetadata extends ServiceComponentMetadata {
    name: string;
}
export interface ResolvedVirtualObjectComponentMetadata extends VirtualObjectComponentMetadata {
    name: string;
}
export interface ResolvedWorkflowComponentMetadata extends WorkflowComponentMetadata {
    name: string;
}

// ── Decorator option types (string | object for backward compat) ──

export type ServiceDecoratorOptions = string | ServiceComponentMetadata;
export type VirtualObjectDecoratorOptions = string | VirtualObjectComponentMetadata;
export type WorkflowDecoratorOptions = string | WorkflowComponentMetadata;
