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
    /**
     * Registration mode:
     * - `'development'` (default): Uses `force: true` for fast iteration. Overwrites existing deployments.
     * - `'production'`: Uses `force: false`. If the deployment already exists unchanged, skips re-registration.
     *   If the interface changed, logs a warning suggesting immutable deployment URLs.
     */
    mode?: "development" | "production";
    /**
     * Force-overwrite existing deployments. Overrides the mode default.
     * Only use this if you understand the implications for in-flight invocations.
     */
    force?: boolean;
    /**
     * Custom metadata attached to the deployment registration.
     * Useful for version tags, commit hashes, or environment labels.
     * @example { version: '1.2.0', commit: 'abc1234' }
     */
    metadata?: Record<string, string>;
    /**
     * Called before registration when component metadata differs between
     * the existing deployment and the new one. Receives per-component diffs
     * and admin connection info for making API calls (cancel, query, etc.).
     *
     * Throwing aborts registration.
     *
     * @example
     * ```ts
     * onDeploymentChange: async (changes, admin) => {
     *   for (const c of changes) {
     *     console.log(`${c.serviceName}: ${JSON.stringify(c.oldMetadata)} → ${JSON.stringify(c.newMetadata)}`);
     *   }
     * }
     * ```
     */
    onDeploymentChange?: (
        changes: DeploymentChange[],
        admin: { url: string; authToken?: string },
    ) => void | Promise<void>;
}

export interface RestateErrorOptions {
    /** Include stack traces in error log output. Default: `false`. */
    stackTraces?: boolean;
}

export interface IngressConfig {
    /** Restate server ingress URL (e.g., http://restate:8080) */
    url: string;
    /**
     * Custom headers sent with all ingress client calls.
     * Use for authentication with Restate Cloud (e.g., `{ Authorization: 'Bearer <token>' }`).
     * Passed through to the SDK's `clients.connect()` options.
     */
    headers?: Record<string, string>;
}

export interface AdminConfig {
    /** Restate admin URL for auto-registration (e.g., http://restate:9070) */
    url: string;
    /**
     * Bearer token for authenticating with the Restate admin API.
     * Required when using Restate Cloud.
     * Sent as `Authorization: Bearer <token>` on all admin API calls (e.g., auto-registration).
     */
    authToken?: string;
}

export interface RestateModuleOptions {
    /** Restate server ingress URL or connection config. */
    ingress: string | IngressConfig;
    /**
     * Custom headers sent with all ingress client calls.
     * @deprecated Use `ingress: { url, headers }` instead. Will be removed in a future major version.
     */
    ingressHeaders?: Record<string, string>;
    /** Restate admin URL or connection config for auto-registration. */
    admin?: string | AdminConfig;
    /**
     * Bearer token for authenticating with the Restate admin API.
     * @deprecated Use `admin: { url, authToken }` instead. Will be removed in a future major version.
     */
    adminAuthToken?: string;
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
    /**
     * Pipeline options controlling NestJS execution pipeline integration.
     * When not specified, all pipeline features are enabled.
     */
    pipeline?: PipelineOptions;
}

export interface PipelineOptions {
    /** Enable guards for Restate handlers. Default: `true`. */
    guards?: boolean;
    /** Enable interceptors for Restate handlers. Default: `true`. */
    interceptors?: boolean;
    /** Enable exception filters for Restate handlers. Default: `true`. */
    filters?: boolean;
}

export interface DeploymentChange {
    /** Restate-registered component name (e.g., "order") */
    serviceName: string;
    /** Component type ("unknown" for removed components not in current discovery) */
    type: "service" | "workflow" | "virtualObject" | "unknown";
    /** Metadata from the currently deployed version. null when no metadata entry exists for this component in the current deployment (new component, or no metadata defined). */
    oldMetadata: Record<string, string> | null;
    /** Metadata from the version about to be deployed. null when no metadata entry exists for this component in the new version (removed component, or no metadata defined). */
    newMetadata: Record<string, string> | null;
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
