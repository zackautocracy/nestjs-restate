import type { Http2Server } from "node:http2";

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

export interface RestateModuleOptions {
    /** Restate server ingress URL (e.g., http://restate:8080) */
    ingress: string;
    /** Restate admin URL for auto-registration (e.g., http://restate:9070) */
    admin?: string;
    /** HTTP/2 endpoint configuration */
    endpoint: EndpointConfig;
    /** Auto-register deployment with Restate server on startup */
    autoRegister?: AutoRegisterOptions;
}

export interface RestateModuleAsyncOptions {
    imports?: any[];
    inject?: any[];
    useFactory: (...args: any[]) => RestateModuleOptions | Promise<RestateModuleOptions>;
}

export type HandlerType = "run" | "handler" | "shared";

export interface HandlerMetadata {
    type: HandlerType;
    methodName: string;
}

export interface ComponentMetadata {
    name: string;
}
