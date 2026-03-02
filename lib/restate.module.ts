import {
    type DynamicModule,
    Global,
    Inject,
    Logger,
    Module,
    type OnModuleDestroy,
    type OnModuleInit,
    type Provider,
    type Type,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import * as clients from "@restatedev/restate-sdk-clients";
import { RestateContext } from "./context/restate-context";
import { RestateExplorer } from "./discovery/restate.explorer";
import { RestateEndpointManager } from "./endpoint/restate.endpoint";
import { createClientProxy } from "./proxy/client-proxy";
import { getClientToken } from "./proxy/client-token";
import { RESTATE_CLIENT, RESTATE_OPTIONS } from "./restate.constants";
import type { RestateModuleAsyncOptions, RestateModuleOptions } from "./restate.interfaces";

@Global()
@Module({})
export class RestateModule implements OnModuleInit, OnModuleDestroy {
    private static readonly logger = new Logger(RestateModule.name);

    constructor(
        private readonly explorer: RestateExplorer,
        private readonly endpointManager: RestateEndpointManager,
        @Inject(RESTATE_OPTIONS)
        private readonly options: RestateModuleOptions,
    ) {}

    private static createClientProviders(clientClasses: Type[] = []): Provider[] {
        return clientClasses.map((target) => ({
            provide: getClientToken(target),
            useFactory: () => createClientProxy(target),
        }));
    }

    static forRoot(options: RestateModuleOptions & { clients?: Type[] }): DynamicModule {
        const { clients: clientClasses, ...moduleOptions } = options;
        const clientProviders = RestateModule.createClientProviders(clientClasses);
        const clientTokens = clientProviders.map((p) => (p as any).provide);
        return {
            module: RestateModule,
            imports: [DiscoveryModule],
            providers: [
                { provide: RESTATE_OPTIONS, useValue: moduleOptions },
                {
                    provide: RESTATE_CLIENT,
                    useFactory: () => clients.connect({ url: moduleOptions.ingress }),
                },
                RestateExplorer,
                RestateEndpointManager,
                RestateContext,
                ...clientProviders,
            ],
            exports: [RESTATE_CLIENT, RestateContext, ...clientTokens],
        };
    }

    static forRootAsync(
        asyncOptions: RestateModuleAsyncOptions & { clients?: Type[] },
    ): DynamicModule {
        const clientProviders = RestateModule.createClientProviders(asyncOptions.clients);
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
                    useFactory: (opts: RestateModuleOptions) =>
                        clients.connect({ url: opts.ingress }),
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
        const definitions = this.explorer.discover();

        for (const def of definitions) {
            this.endpointManager.addDefinition(def);
        }

        if (definitions.length > 0) {
            await this.endpointManager.start(this.options.endpoint, {
                identityKeys: this.options.identityKeys,
                defaultServiceOptions: this.options.defaultServiceOptions,
            });
        }

        if (this.options.autoRegister && this.options.admin) {
            await this.registerDeployment();
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.endpointManager.stop();
    }

    private async registerDeployment(): Promise<void> {
        const { autoRegister, admin } = this.options;

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

        try {
            const url = `${admin}/deployments`;
            const body = JSON.stringify({
                uri: deploymentUrl,
                force: autoRegister.force ?? true,
            });

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
            });

            if (response.ok) {
                RestateModule.logger.log(
                    `Deployment auto-registered at ${admin} with URI ${deploymentUrl}`,
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
