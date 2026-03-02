import {
    type DynamicModule,
    Global,
    Inject,
    Logger,
    Module,
    type OnModuleDestroy,
    type OnModuleInit,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import * as clients from "@restatedev/restate-sdk-clients";
import { RestateExplorer } from "./discovery/restate.explorer";
import { RestateEndpointManager } from "./endpoint/restate.endpoint";
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

    static forRoot(options: RestateModuleOptions): DynamicModule {
        return {
            module: RestateModule,
            imports: [DiscoveryModule],
            providers: [
                { provide: RESTATE_OPTIONS, useValue: options },
                {
                    provide: RESTATE_CLIENT,
                    useFactory: () => clients.connect({ url: options.ingress }),
                },
                RestateExplorer,
                RestateEndpointManager,
            ],
            exports: [RESTATE_CLIENT],
        };
    }

    static forRootAsync(asyncOptions: RestateModuleAsyncOptions): DynamicModule {
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
            ],
            exports: [RESTATE_CLIENT],
        };
    }

    async onModuleInit(): Promise<void> {
        const definitions = this.explorer.discover();

        for (const def of definitions) {
            this.endpointManager.addDefinition(def);
        }

        if (definitions.length > 0) {
            await this.endpointManager.start(this.options.endpoint);
        }

        if (this.options.autoRegister && this.options.admin) {
            await this.registerDeployment();
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.endpointManager.stop();
    }

    private async registerDeployment(): Promise<void> {
        const endpointPort = "port" in this.options.endpoint ? this.options.endpoint.port : null;

        if (!endpointPort || !this.options.admin) {
            RestateModule.logger.warn(
                "Auto-registration requires a port-based endpoint and admin URL",
            );
            return;
        }

        try {
            const url = `${this.options.admin}/deployments`;
            const body = JSON.stringify({
                uri: `http://host.docker.internal:${endpointPort}`,
                force: true,
            });

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
            });

            if (response.ok) {
                RestateModule.logger.log(
                    `Deployment auto-registered with Restate server at ${this.options.admin}`,
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
