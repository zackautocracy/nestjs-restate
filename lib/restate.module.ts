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
    DeploymentMetadataChange,
    IngressConfig,
    RestateModuleAsyncOptions,
    RestateModuleOptions,
} from "./restate.interfaces";

function stableStringify(obj: Record<string, string> | null): string | null {
    if (obj === null) return null;
    const sorted = Object.keys(obj)
        .sort()
        .reduce<Record<string, string>>((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {});
    return JSON.stringify(sorted);
}

export function computeInterfaceHash(summary: ComponentSummary[]): string {
    const sorted = [...summary]
        .sort((a, b) => a.componentName.localeCompare(b.componentName))
        .map(({ metadata, ...rest }) => ({
            ...rest,
            handlers: [...rest.handlers].sort((a, b) => a.name.localeCompare(b.name)),
        }));
    const json = JSON.stringify(sorted);
    const hash = createHash("sha256").update(json).digest("hex");
    return `sha256:${hash}`;
}

@Global()
@Module({})
export class RestateModule implements OnModuleInit, OnModuleDestroy {
    private static readonly logger = new Logger("RestateModule");
    private static readonly deploymentLogger = new Logger("RestateDeployment");
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
            // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires bracket notation on Record
            headers["Authorization"] = `Bearer ${admin.authToken}`;
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
            RestateModule.deploymentLogger.warn(
                "autoRegister.deploymentUrl contains {{port}} placeholder but no port is available (lambda mode or no services). Skipping registration.",
            );
            return;
        }

        const deploymentUrl = autoRegister.deploymentUrl.replace("{{port}}", String(listeningPort));
        const mode = autoRegister.mode ?? "development";
        const effectiveForce =
            autoRegister.force !== undefined ? autoRegister.force : mode !== "production";

        const hash = computeInterfaceHash(this.componentSummary);

        // Collect per-component metadata into a JSON blob
        const componentMetadataMap: Record<string, Record<string, string>> = {};
        for (const cs of this.componentSummary) {
            if (cs.metadata && Object.keys(cs.metadata).length > 0) {
                componentMetadataMap[cs.componentName] = cs.metadata;
            }
        }

        const metadata: Record<string, string> = {
            ...autoRegister.metadata,
            "nestjs-restate.interface-hash": hash,
        };
        if (Object.keys(componentMetadataMap).length > 0) {
            metadata["nestjs-restate.component-metadata"] = JSON.stringify(componentMetadataMap);
        }

        // Unified GET: serves both hook diff and production pre-check
        const needsGet = autoRegister.onDeploymentMetadataChange || mode === "production";
        let metadataChangesDetected = false;
        let existingHashMatches = false;

        if (needsGet) {
            try {
                const getUrl = `${admin.url}/deployments`;
                const getResponse = await fetch(getUrl, {
                    headers: this.buildAdminHeaders(admin),
                });
                if (getResponse.ok) {
                    const data: any = await getResponse.json();
                    const deployments = data.deployments ?? data;
                    const normalizeUri = (uri: string) => uri.replace(/\/+$/, "");
                    const normalizedDeploymentUrl = normalizeUri(deploymentUrl);
                    const existing = Array.isArray(deployments)
                        ? deployments.find(
                              (d: any) =>
                                  normalizeUri(d.uri ?? "") === normalizedDeploymentUrl ||
                                  normalizeUri(d.deployment?.uri ?? "") ===
                                      normalizedDeploymentUrl ||
                                  normalizeUri(d.endpoint?.uri ?? "") === normalizedDeploymentUrl,
                          )
                        : undefined;
                    const existingMeta =
                        existing?.metadata ??
                        existing?.deployment?.metadata ??
                        existing?.endpoint?.metadata;

                    // Check interface hash for production pre-check
                    if (existingMeta?.["nestjs-restate.interface-hash"] === hash) {
                        existingHashMatches = true;
                    }

                    // Diff component metadata
                    const changes = this.diffComponentMetadata(
                        existingMeta?.["nestjs-restate.component-metadata"],
                        componentMetadataMap,
                    );

                    if (changes.length > 0) {
                        metadataChangesDetected = true;
                        if (autoRegister.onDeploymentMetadataChange) {
                            try {
                                await autoRegister.onDeploymentMetadataChange(changes, {
                                    url: admin.url,
                                    authToken: admin.authToken,
                                });
                            } catch (hookError: any) {
                                RestateModule.deploymentLogger.error(
                                    `onDeploymentMetadataChange hook threw — aborting registration: ${hookError?.message ?? hookError}`,
                                );
                                return;
                            }
                        }
                    }
                }
            } catch (error: any) {
                RestateModule.deploymentLogger.debug(
                    `Pre-check GET /deployments failed (${error?.message ?? error}), falling through to POST`,
                );
            }
        }

        // Production skip-check: skip POST only if hash matches AND no metadata changes
        if (mode === "production" && existingHashMatches && !metadataChangesDetected) {
            RestateModule.deploymentLogger.log(
                `Deployment unchanged at ${admin.url} (URI: ${deploymentUrl}), skipping registration`,
            );
            return;
        }

        try {
            const url = `${admin.url}/deployments`;
            const body = JSON.stringify({
                uri: deploymentUrl,
                force: effectiveForce || metadataChangesDetected,
                metadata,
            });

            const response = await fetch(url, {
                method: "POST",
                headers: this.buildAdminHeaders(admin, "application/json"),
                body,
            });

            if (response.status === 201) {
                RestateModule.deploymentLogger.log(
                    `New deployment registered at ${admin.url} (URI: ${deploymentUrl})`,
                );
            } else if (response.status === 200) {
                RestateModule.deploymentLogger.log(
                    `Deployment re-registered at ${admin.url} (URI: ${deploymentUrl}), component interface unchanged`,
                );
            } else if (response.status === 409) {
                const text = await response.text();
                RestateModule.deploymentLogger.warn(
                    `Deployment conflict at ${admin.url} — interface changed. Use a new deployment URL or set force: true. ${text}`.trim(),
                );
            } else {
                const text = await response.text();
                RestateModule.deploymentLogger.warn(
                    `Failed to auto-register deployment: ${response.status} ${text}`,
                );
            }
        } catch (error: any) {
            RestateModule.deploymentLogger.warn(
                `Failed to auto-register deployment: ${error.message}`,
            );
        }
    }

    private diffComponentMetadata(
        oldMetadataJson: string | undefined | null,
        newMetadataMap: Record<string, Record<string, string>>,
    ): DeploymentMetadataChange[] {
        let oldMap: Record<string, Record<string, string>> = {};
        if (oldMetadataJson) {
            try {
                const parsed = JSON.parse(oldMetadataJson);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    oldMap = parsed;
                }
            } catch {
                RestateModule.deploymentLogger.warn(
                    "Failed to parse old component metadata, treating as empty",
                );
            }
        }

        const changes: DeploymentMetadataChange[] = [];
        const allNames = new Set([...Object.keys(oldMap), ...Object.keys(newMetadataMap)]);

        for (const name of allNames) {
            const oldMeta = oldMap[name] ?? null;
            const newMeta = newMetadataMap[name] ?? null;

            // Compare with sorted keys so {a:'1',b:'2'} equals {b:'2',a:'1'}
            if (stableStringify(oldMeta) === stableStringify(newMeta)) continue;

            // Determine component type from current discovery
            const summary = this.componentSummary.find((cs) => cs.componentName === name);
            const type = (summary?.componentType ?? "unknown") as DeploymentMetadataChange["type"];

            changes.push({
                serviceName: name,
                type,
                oldMetadata: oldMeta,
                newMetadata: newMeta,
            });
        }

        return changes;
    }
}
