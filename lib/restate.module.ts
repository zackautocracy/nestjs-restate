import { createHash } from "node:crypto";
import {
    type DynamicModule,
    Global,
    Inject,
    Logger,
    Module,
    type OnModuleDestroy,
    type OnModuleInit,
    type Provider,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import * as clients from "@restatedev/restate-sdk-clients";
import { RestateContext } from "./context/restate-context";
import type { ComponentSummary } from "./discovery/restate.explorer";
import { RestateExplorer } from "./discovery/restate.explorer";
import { RestateEndpointManager } from "./endpoint/restate.endpoint";
import { createRestateIngress } from "./ingress/restate-ingress";
import { RestateLoggerService } from "./logging/restate-logger.service";
import { createClientProxy } from "./proxy/client-proxy";
import { getClientToken } from "./proxy/client-token";
import { getRegisteredComponents } from "./registry/component-registry";
import { RESTATE_CLIENT, RESTATE_OPTIONS } from "./restate.constants";
import type {
    AdminConfig,
    IngressConfig,
    RestateModuleAsyncOptions,
    RestateModuleOptions,
} from "./restate.interfaces";

export function computeInterfaceHash(summary: ComponentSummary[]): string {
    const sorted = [...summary]
        .sort((a, b) => a.componentName.localeCompare(b.componentName))
        .map((c) => ({
            ...c,
            handlers: [...c.handlers].sort((a, b) => a.name.localeCompare(b.name)),
        }));
    const json = JSON.stringify(sorted);
    const hash = createHash("sha256").update(json).digest("hex");
    return `sha256:${hash}`;
}

@Global()
@Module({})
export class RestateModule implements OnModuleInit, OnModuleDestroy {
    private static readonly logger = new Logger(RestateModule.name);
    private componentSummary: ComponentSummary[] = [];

    constructor(
        private readonly explorer: RestateExplorer,
        private readonly endpointManager: RestateEndpointManager,
        @Inject(RESTATE_OPTIONS)
        private readonly options: RestateModuleOptions,
    ) {}

    private static resolveIngress(options: RestateModuleOptions): IngressConfig {
        if (typeof options.ingress === "object") {
            if (options.ingressHeaders) {
                RestateModule.logger.warn(
                    "ingressHeaders is ignored when ingress is an object — use ingress.headers instead",
                );
            }
            return options.ingress;
        }
        return { url: options.ingress, headers: options.ingressHeaders };
    }

    private static resolveAdmin(options: RestateModuleOptions): AdminConfig | undefined {
        if (!options.admin) return undefined;
        if (typeof options.admin === "object") {
            if (options.adminAuthToken) {
                RestateModule.logger.warn(
                    "adminAuthToken is ignored when admin is an object — use admin.authToken instead",
                );
            }
            return options.admin;
        }
        return { url: options.admin, authToken: options.adminAuthToken };
    }

    private static createAutoClientProviders(): Provider[] {
        return [...getRegisteredComponents()].map((target) => ({
            provide: getClientToken(target),
            useFactory: () => createClientProxy(target),
        }));
    }

    static forRoot(options: RestateModuleOptions): DynamicModule {
        const clientProviders = RestateModule.createAutoClientProviders();
        const clientTokens = clientProviders.map((p) => (p as any).provide);
        const ingress = RestateModule.resolveIngress(options);
        return {
            module: RestateModule,
            imports: [DiscoveryModule],
            providers: [
                { provide: RESTATE_OPTIONS, useValue: options },
                {
                    provide: RESTATE_CLIENT,
                    useFactory: () => {
                        const connectOpts: { url: string; headers?: Record<string, string> } = {
                            url: ingress.url,
                        };
                        if (ingress.headers) {
                            connectOpts.headers = ingress.headers;
                        }
                        return createRestateIngress(clients.connect(connectOpts));
                    },
                },
                RestateExplorer,
                RestateEndpointManager,
                RestateContext,
                ...clientProviders,
            ],
            exports: [RESTATE_CLIENT, RestateContext, ...clientTokens],
        };
    }

    static forRootAsync(asyncOptions: RestateModuleAsyncOptions): DynamicModule {
        const clientProviders = RestateModule.createAutoClientProviders();
        const clientTokens = clientProviders.map((p) => (p as any).provide);
        return {
            module: RestateModule,
            imports: [DiscoveryModule, ...(asyncOptions.imports || [])],
            providers: [
                {
                    provide: RESTATE_OPTIONS,
                    useFactory: asyncOptions.useFactory,
                    inject: asyncOptions.inject || [],
                },
                {
                    provide: RESTATE_CLIENT,
                    useFactory: (opts: RestateModuleOptions) => {
                        const ingress = RestateModule.resolveIngress(opts);
                        const connectOpts: { url: string; headers?: Record<string, string> } = {
                            url: ingress.url,
                        };
                        if (ingress.headers) {
                            connectOpts.headers = ingress.headers;
                        }
                        return createRestateIngress(clients.connect(connectOpts));
                    },
                    inject: [RESTATE_OPTIONS],
                },
                RestateExplorer,
                RestateEndpointManager,
                RestateContext,
                ...clientProviders,
            ],
            exports: [RESTATE_CLIENT, RestateContext, ...clientTokens],
        };
    }

    async onModuleInit(): Promise<void> {
        Logger.overrideLogger(new RestateLoggerService());
        const { definitions, serviceClassNames, componentSummary } = this.explorer.discover();
        this.componentSummary = componentSummary;

        for (const def of definitions) {
            this.endpointManager.addDefinition(def);
        }

        if (definitions.length > 0) {
            await this.endpointManager.start(this.options.endpoint, {
                identityKeys: this.options.identityKeys,
                defaultServiceOptions: this.options.defaultServiceOptions,
                errors: this.options.errors,
                serviceClassNames,
            });
        }

        if (this.options.autoRegister && this.options.admin) {
            await this.registerDeployment();
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.endpointManager.stop();
    }

    private buildAdminHeaders(admin: AdminConfig, contentType?: string): Record<string, string> {
        const headers: Record<string, string> = {};
        if (contentType) {
            headers["Content-Type"] = contentType;
        }
        if (admin.authToken) {
            headers.Authorization = `Bearer ${admin.authToken}`;
        }
        return headers;
    }

    private async registerDeployment(): Promise<void> {
        const admin = RestateModule.resolveAdmin(this.options);
        const { autoRegister } = this.options;

        if (!autoRegister || !admin) {
            return;
        }

        const listeningPort = this.endpointManager.getListeningPort();

        if (autoRegister.deploymentUrl.includes("{{port}}") && listeningPort === null) {
            RestateModule.logger.warn(
                "autoRegister.deploymentUrl contains {{port}} placeholder but no port is available (lambda mode or no services). Skipping registration.",
            );
            return;
        }

        const deploymentUrl = autoRegister.deploymentUrl.replace("{{port}}", String(listeningPort));
        const mode = autoRegister.mode ?? "development";
        const effectiveForce =
            autoRegister.force !== undefined ? autoRegister.force : mode !== "production";

        const hash = computeInterfaceHash(this.componentSummary);
        const metadata: Record<string, string> = {
            ...autoRegister.metadata,
            "nestjs-restate.interface-hash": hash,
        };

        // Production mode pre-check: skip POST if deployment already registered with same hash
        if (mode === "production") {
            try {
                const getUrl = `${admin.url}/deployments`;
                const getResponse = await fetch(getUrl, {
                    headers: this.buildAdminHeaders(admin),
                });
                if (getResponse.ok) {
                    const data: any = await getResponse.json();
                    const deployments = data.deployments ?? data;
                    const existing = Array.isArray(deployments)
                        ? deployments.find(
                              (d: any) =>
                                  d.uri === deploymentUrl ||
                                  d.deployment?.uri === deploymentUrl ||
                                  d.endpoint?.uri === deploymentUrl,
                          )
                        : undefined;
                    const existingMeta =
                        existing?.metadata ??
                        existing?.deployment?.metadata ??
                        existing?.endpoint?.metadata;
                    if (existing && existingMeta?.["nestjs-restate.interface-hash"] === hash) {
                        RestateModule.logger.log(
                            `Deployment already registered at ${admin.url} (URI: ${deploymentUrl}), no changes detected`,
                        );
                        return;
                    }
                }
            } catch (error: any) {
                // GET failed — fall through to POST
                RestateModule.logger.debug(
                    `Pre-check GET /deployments failed (${error?.message ?? error}), falling through to POST`,
                );
            }
        }

        try {
            const url = `${admin.url}/deployments`;
            const body = JSON.stringify({
                uri: deploymentUrl,
                force: effectiveForce,
                metadata,
            });

            const response = await fetch(url, {
                method: "POST",
                headers: this.buildAdminHeaders(admin, "application/json"),
                body,
            });

            if (response.status === 201) {
                RestateModule.logger.log(
                    `New deployment registered at ${admin.url} (URI: ${deploymentUrl})`,
                );
            } else if (response.status === 200) {
                RestateModule.logger.log(
                    `Deployment already registered at ${admin.url} (URI: ${deploymentUrl}), no changes detected`,
                );
            } else if (response.status === 409) {
                const text = await response.text();
                RestateModule.logger.warn(
                    `Deployment conflict at ${admin.url} — interface changed. Use a new deployment URL or set force: true. ${text}`.trim(),
                );
            } else {
                const text = await response.text();
                RestateModule.logger.warn(
                    `Failed to auto-register deployment: ${response.status} ${text}`,
                );
            }
        } catch (error: any) {
            RestateModule.logger.warn(`Failed to auto-register deployment: ${error.message}`);
        }
    }
}
