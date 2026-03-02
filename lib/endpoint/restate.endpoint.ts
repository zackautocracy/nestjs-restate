import type * as http2 from "node:http2";
import { Injectable, Logger } from "@nestjs/common";
import * as restate from "@restatedev/restate-sdk";
import type { EndpointConfig, RestateEndpointServerConfig } from "../restate.interfaces";

@Injectable()
export class RestateEndpointManager {
    private readonly logger = new Logger(RestateEndpointManager.name);
    private readonly definitions: any[] = [];
    private httpServer: http2.Http2Server | null = null;
    private listeningPort: number | null = null;

    addDefinition(definition: any): void {
        this.definitions.push(definition);
    }

    getDefinitions(): any[] {
        return this.definitions;
    }

    async start(config: EndpointConfig): Promise<void> {
        if (this.definitions.length === 0) {
            this.logger.warn("No Restate definitions to serve");
            return;
        }

        if ("server" in config) {
            const serverConfig = config as RestateEndpointServerConfig;
            const handler = restate.createEndpointHandler({
                services: this.definitions,
            });
            serverConfig.server.on("request", handler);
            this.httpServer = serverConfig.server;
            this.logger.log("Restate endpoint attached to existing HTTP/2 server");
            return;
        }

        if ("port" in config) {
            this.listeningPort = await restate.serve({
                port: config.port,
                services: this.definitions,
            });
            this.logger.log(`Restate endpoint listening on port ${this.listeningPort}`);
            return;
        }

        // Lambda mode — nothing to start
        this.logger.log("Restate endpoint configured for lambda mode");
    }

    async stop(): Promise<void> {
        if (this.httpServer) {
            const server = this.httpServer;
            await new Promise<void>((resolve) => {
                server.close(() => {
                    this.logger.log("Restate endpoint shut down");
                    resolve();
                });
            });
            this.httpServer = null;
        }
        this.listeningPort = null;
    }

    getListeningPort(): number | null {
        return this.listeningPort;
    }
}
