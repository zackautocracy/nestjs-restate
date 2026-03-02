import type * as http2 from "node:http2";

export interface RestateEndpointPortConfig {
    port: number;
}

export interface RestateEndpointServerConfig {
    server: http2.Http2Server;
}

export interface RestateEndpointLambdaConfig {
    type: "lambda";
}

export type EndpointConfig =
    | RestateEndpointPortConfig
    | RestateEndpointServerConfig
    | RestateEndpointLambdaConfig;

export interface RestateModuleOptions {
    /** Restate server ingress URL (e.g., http://restate:8080) */
    ingress: string;
    /** Restate admin URL for auto-registration (e.g., http://restate:9070) */
    admin?: string;
    /** HTTP/2 endpoint configuration */
    endpoint: EndpointConfig;
    /** Auto-register deployment with Restate server on startup (default: false) */
    autoRegister?: boolean;
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
