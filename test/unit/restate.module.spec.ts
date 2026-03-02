import "reflect-metadata";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Handler, RESTATE_CLIENT, RestateModule, Service } from "nestjs-restate";
import { RestateEndpointManager } from "nestjs-restate/endpoint/restate.endpoint";
import { RESTATE_OPTIONS } from "nestjs-restate/restate.constants";

describe("RestateModule", () => {
    describe("forRoot", () => {
        it("should create module with RESTATE_OPTIONS provider", async () => {
            const options = {
                ingress: "http://localhost:8080",
                endpoint: { port: 9080 },
            };

            const module = await Test.createTestingModule({
                imports: [RestateModule.forRoot(options)],
            }).compile();

            const resolvedOptions = module.get(RESTATE_OPTIONS);
            expect(resolvedOptions).toEqual(options);

            await module.close();
        });

        it("should create module with RESTATE_CLIENT provider", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        endpoint: { port: 9080 },
                    }),
                ],
            }).compile();

            const client = module.get(RESTATE_CLIENT);
            expect(client).toBeDefined();
            expect(typeof client.serviceClient).toBe("function");
            expect(typeof client.workflowClient).toBe("function");
            expect(typeof client.objectClient).toBe("function");

            await module.close();
        });
    });

    describe("forRootAsync", () => {
        it("should create module with async factory", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRootAsync({
                        useFactory: () => ({
                            ingress: "http://localhost:8080",
                            endpoint: { port: 9080 },
                        }),
                    }),
                ],
            }).compile();

            const client = module.get(RESTATE_CLIENT);
            expect(client).toBeDefined();
            expect(typeof client.serviceClient).toBe("function");

            const options = module.get(RESTATE_OPTIONS);
            expect(options.ingress).toBe("http://localhost:8080");

            await module.close();
        });

        it("should support inject dependencies in factory", async () => {
            const CONFIG_TOKEN = "CONFIG";

            @Global()
            @Module({
                providers: [
                    {
                        provide: CONFIG_TOKEN,
                        useValue: { url: "http://custom:8080" },
                    },
                ],
                exports: [CONFIG_TOKEN],
            })
            class ConfigModule {}

            const module = await Test.createTestingModule({
                imports: [
                    ConfigModule,
                    RestateModule.forRootAsync({
                        inject: [CONFIG_TOKEN],
                        useFactory: (config: { url: string }) => ({
                            ingress: config.url,
                            endpoint: { port: 9080 },
                        }),
                    }),
                ],
            }).compile();

            const options = module.get(RESTATE_OPTIONS);
            expect(options.ingress).toBe("http://custom:8080");

            await module.close();
        });
    });

    describe("autoRegister", () => {
        let fetchSpy: ReturnType<typeof vi.fn>;
        const originalFetch = globalThis.fetch;

        @Service("test-svc")
        class TestSvc {
            @Handler()
            async handle() {
                return "ok";
            }
        }

        beforeEach(() => {
            fetchSpy = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: () => Promise.resolve(""),
            });
            globalThis.fetch = fetchSpy;
        });

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it("should register deployment with explicit deploymentUrl", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:9080",
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            expect(fetchSpy).toHaveBeenCalledOnce();
            const [url, options] = fetchSpy.mock.calls[0];
            expect(url).toBe("http://localhost:9070/deployments");
            const body = JSON.parse(options.body);
            expect(body.uri).toBe("http://my-host:9080");
            expect(body.force).toBe(true);

            await app.close();
        });

        it("should replace {{port}} placeholder with actual listening port", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:{{port}}",
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            const endpointManager = module.get(RestateEndpointManager);
            const actualPort = endpointManager.getListeningPort();
            expect(actualPort).toBeGreaterThan(0);

            const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
            expect(body.uri).toBe(`http://my-host:${actualPort}`);

            await app.close();
        });

        it("should respect force: false option", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:9080",
                            force: false,
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
            expect(body.force).toBe(false);

            await app.close();
        });

        it("should not register when autoRegister is not set", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        endpoint: { port: 0 },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            expect(fetchSpy).not.toHaveBeenCalled();

            await app.close();
        });
    });

    describe("endpoint configuration", () => {
        it("should forward defaultServiceOptions to endpoint manager", async () => {
            @Service("config-svc")
            class ConfigSvc {
                @Handler()
                async handle() {
                    return "ok";
                }
            }

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        endpoint: { port: 0 },
                        defaultServiceOptions: {
                            retryPolicy: { maxAttempts: 5 },
                        },
                    }),
                ],
                providers: [ConfigSvc],
            }).compile();

            const options = module.get(RESTATE_OPTIONS);
            expect(options.defaultServiceOptions).toEqual({
                retryPolicy: { maxAttempts: 5 },
            });

            const app = module.createNestApplication();
            await app.init();

            // Verify the endpoint started (port was assigned)
            const endpointManager = module.get(RestateEndpointManager);
            expect(endpointManager.getListeningPort()).toBeGreaterThan(0);

            await app.close();
        });

        it("should accept defaultServiceOptions via forRootAsync", async () => {
            @Service("async-config-svc")
            class AsyncConfigSvc {
                @Handler()
                async handle() {
                    return "ok";
                }
            }

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRootAsync({
                        useFactory: () => ({
                            ingress: "http://localhost:8080",
                            endpoint: { port: 0 },
                            defaultServiceOptions: {
                                retryPolicy: { maxAttempts: 10 },
                            },
                        }),
                    }),
                ],
                providers: [AsyncConfigSvc],
            }).compile();

            const options = module.get(RESTATE_OPTIONS);
            expect(options.defaultServiceOptions?.retryPolicy?.maxAttempts).toBe(10);

            const app = module.createNestApplication();
            await app.init();

            const endpointManager = module.get(RestateEndpointManager);
            expect(endpointManager.getListeningPort()).toBeGreaterThan(0);

            await app.close();
        });

        it("should store identityKeys in module options", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        endpoint: { port: 9080 },
                        identityKeys: ["publickeyv1_somekey"],
                    }),
                ],
            }).compile();

            const options = module.get(RESTATE_OPTIONS);
            expect(options.identityKeys).toEqual(["publickeyv1_somekey"]);

            await module.close();
        });
    });
});
