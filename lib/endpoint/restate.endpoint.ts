import * as http2 from "node:http2";
import { Injectable, Logger } from "@nestjs/common";
import * as restate from "@restatedev/restate-sdk";
import type { EndpointConfig, RestateEndpointServerConfig } from "../restate.interfaces";

@Injectable()
export class RestateEndpointManager {
    private readonly logger = new Logger(RestateEndpointManager.name);
    private readonly definitions: any[] = [];
    private readonly sessions = new Set<http2.ServerHttp2Session>();
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

        const handler = restate.createEndpointHandler({
            services: this.definitions,
        });

        if ("server" in config) {
            const serverConfig = config as RestateEndpointServerConfig;
            serverConfig.server.on("request", handler);
            this.httpServer = serverConfig.server;
            this.trackSessions(serverConfig.server);
            this.logger.log("Restate endpoint attached to existing HTTP/2 server");
            return;
        }

        if ("port" in config) {
            const server = http2.createServer();
            this.trackSessions(server);
            server.on("request", handler);

            await new Promise<void>((resolve, reject) => {
                server.once("error", reject);
                server.listen(config.port, () => {
                    server.removeListener("error", reject);
                    resolve();
                });
            });

            this.httpServer = server;
            const addr = server.address();
            this.listeningPort =
                typeof addr === "object" && addr !== null ? addr.port : config.port;
            this.logger.log(`Restate endpoint listening on port ${this.listeningPort}`);
            return;
        }

        // Lambda mode — nothing to start
        this.logger.log("Restate endpoint configured for lambda mode");
    }

    async stop(): Promise<void> {
        if (this.httpServer) {
            const server = this.httpServer;
            // Destroy all active HTTP/2 sessions so close() can finish.
            // Without this, persistent connections (e.g., from Restate discovery)
            // keep the server alive indefinitely.
            for (const session of this.sessions) {
                session.destroy();
            }
            this.sessions.clear();
            await new Promise<void>((resolve) => {
                server.close(() => resolve());
            });
            this.logger.log("Restate endpoint shut down");
            this.httpServer = null;
        }
        this.listeningPort = null;
    }

    private trackSessions(server: http2.Http2Server): void {
        server.on("session", (session: http2.ServerHttp2Session) => {
            this.sessions.add(session);
            session.on("close", () => this.sessions.delete(session));
        });
    }

    getListeningPort(): number | null {
        return this.listeningPort;
    }
}
