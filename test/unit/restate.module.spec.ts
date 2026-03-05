import "reflect-metadata";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
    Handler,
    RESTATE_CLIENT,
    RestateModule,
    Run,
    Service,
    VirtualObject,
    Workflow,
} from "nestjs-restate";
import { RestateContext } from "nestjs-restate/context/restate-context";
import { RestateEndpointManager } from "nestjs-restate/endpoint/restate.endpoint";
import { getClientToken } from "nestjs-restate/proxy/client-token";
import { RESTATE_OPTIONS } from "nestjs-restate/restate.constants";
import { computeInterfaceHash } from "nestjs-restate/restate.module";

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
            expect(body.metadata).toBeDefined();
            expect(body.metadata["nestjs-restate.interface-hash"]).toMatch(/^sha256:/);

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

        it("should skip registration when {{port}} placeholder used in lambda mode", async () => {
            const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
            const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { type: "lambda" },
                        autoRegister: {
                            deploymentUrl: "http://my-host:{{port}}",
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            expect(fetchSpy).not.toHaveBeenCalled();
            const allOutput = [
                ...stderrSpy.mock.calls.map((c) => String(c[0])),
                ...stdoutSpy.mock.calls.map((c) => String(c[0])),
            ];
            const warnLogs = allOutput.filter((s) => s.includes("{{port}} placeholder"));
            expect(warnLogs.length).toBeGreaterThan(0);

            await app.close();
            stderrSpy.mockRestore();
            stdoutSpy.mockRestore();
        });

        it("should send force: false in production mode by default", async () => {
            fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
                if (!opts || opts.method !== "POST") {
                    // GET /deployments — no matching deployment
                    return {
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({ deployments: [] }),
                    };
                }
                return {
                    ok: true,
                    status: 201,
                    text: () => Promise.resolve(""),
                };
            });

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:9080",
                            mode: "production",
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            // First call is GET pre-check, second is POST
            const postCall = fetchSpy.mock.calls.find((c: any[]) => c[1]?.method === "POST");
            expect(postCall).toBeDefined();
            const body = JSON.parse(postCall?.[1].body);
            expect(body.force).toBe(false);

            await app.close();
        });

        it("should allow explicit force: true to override production mode", async () => {
            fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
                if (!opts || opts.method !== "POST") {
                    // GET /deployments — no matching deployment
                    return {
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({ deployments: [] }),
                    };
                }
                return {
                    ok: true,
                    status: 201,
                    text: () => Promise.resolve(""),
                };
            });

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:9080",
                            mode: "production",
                            force: true,
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            const postCall = fetchSpy.mock.calls.find((c: any[]) => c[1]?.method === "POST");
            expect(postCall).toBeDefined();
            const body = JSON.parse(postCall?.[1].body);
            expect(body.force).toBe(true);

            await app.close();
        });

        it("should send custom metadata in POST body", async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                status: 201,
                text: () => Promise.resolve(""),
            });

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:9080",
                            metadata: { version: "1.2.0", commit: "abc1234" },
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
            expect(body.metadata).toBeDefined();
            expect(body.metadata["nestjs-restate.interface-hash"]).toMatch(/^sha256:/);
            expect(body.metadata.version).toBe("1.2.0");
            expect(body.metadata.commit).toBe("abc1234");

            await app.close();
        });

        it("should not allow custom metadata to override interface hash", async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                status: 201,
                text: () => Promise.resolve(""),
            });

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:9080",
                            metadata: { "nestjs-restate.interface-hash": "evil" },
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
            expect(body.metadata["nestjs-restate.interface-hash"]).toMatch(/^sha256:/);
            expect(body.metadata["nestjs-restate.interface-hash"]).not.toBe("evil");

            await app.close();
        });

        it("should skip POST when production mode GET finds matching hash", async () => {
            // Compute the expected hash for a single service with one handler
            const expectedHash = computeInterfaceHash([
                {
                    componentName: "test-svc",
                    componentType: "service",
                    handlers: [{ name: "handle", type: "handler" }],
                },
            ]);

            fetchSpy.mockImplementation(async (url: string, opts?: any) => {
                if (!opts || opts.method !== "POST") {
                    // GET /deployments
                    return {
                        ok: true,
                        status: 200,
                        json: () =>
                            Promise.resolve({
                                deployments: [
                                    {
                                        uri: "http://my-host:9080",
                                        metadata: {
                                            "nestjs-restate.interface-hash": expectedHash,
                                        },
                                    },
                                ],
                            }),
                    };
                }
                return {
                    ok: true,
                    status: 201,
                    text: () => Promise.resolve(""),
                };
            });

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:9080",
                            mode: "production",
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            // Should have only the GET, no POST
            const postCalls = fetchSpy.mock.calls.filter((c: any[]) => c[1]?.method === "POST");
            expect(postCalls).toHaveLength(0);

            await app.close();
        });

        it("should fall through to POST when production mode GET fails", async () => {
            fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
                if (!opts || opts.method !== "POST") {
                    // GET /deployments fails
                    throw new Error("connection refused");
                }
                return {
                    ok: true,
                    status: 201,
                    text: () => Promise.resolve(""),
                };
            });

            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        admin: "http://localhost:9070",
                        endpoint: { port: 0 },
                        autoRegister: {
                            deploymentUrl: "http://my-host:9080",
                            mode: "production",
                        },
                    }),
                ],
                providers: [TestSvc],
            }).compile();

            const app = module.createNestApplication();
            await app.init();

            // Should have called POST despite GET failure
            const postCalls = fetchSpy.mock.calls.filter((c: any[]) => c[1]?.method === "POST");
            expect(postCalls).toHaveLength(1);

            await app.close();
        });

        it("should log different messages for 201 vs 200 status", async () => {
            const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

            // Test 201 response
            fetchSpy.mockResolvedValue({
                ok: true,
                status: 201,
                text: () => Promise.resolve(""),
            });

            const module1 = await Test.createTestingModule({
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

            const app1 = module1.createNestApplication();
            await app1.init();

            const logCalls201 = stdoutSpy.mock.calls
                .map((c) => String(c[0]))
                .filter((s) => s.includes("New deployment registered"));
            expect(logCalls201.length).toBeGreaterThan(0);

            await app1.close();

            stdoutSpy.mockClear();

            // Test 200 response
            fetchSpy.mockResolvedValue({
                ok: true,
                status: 200,
                text: () => Promise.resolve(""),
            });

            const module2 = await Test.createTestingModule({
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

            const app2 = module2.createNestApplication();
            await app2.init();

            const logCalls200 = stdoutSpy.mock.calls
                .map((c) => String(c[0]))
                .filter((s) => s.includes("already registered"));
            expect(logCalls200.length).toBeGreaterThan(0);

            await app2.close();
            stdoutSpy.mockRestore();
        });

        it("should log warning on 409 conflict", async () => {
            const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
            const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

            fetchSpy.mockResolvedValue({
                ok: false,
                status: 409,
                text: () => Promise.resolve("conflict"),
            });

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

            const allOutput = [
                ...stderrSpy.mock.calls.map((c) => String(c[0])),
                ...stdoutSpy.mock.calls.map((c) => String(c[0])),
            ];
            const conflictLogs = allOutput.filter((s) => s.includes("Deployment conflict"));
            expect(conflictLogs.length).toBeGreaterThan(0);

            await app.close();
            stderrSpy.mockRestore();
            stdoutSpy.mockRestore();
        });

        it("should warn on unexpected status codes", async () => {
            const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
            const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

            fetchSpy.mockResolvedValue({
                ok: false,
                status: 500,
                text: () => Promise.resolve("internal server error"),
            });

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

            const allOutput = [
                ...stderrSpy.mock.calls.map((c) => String(c[0])),
                ...stdoutSpy.mock.calls.map((c) => String(c[0])),
            ];
            const warnLogs = allOutput.filter((s) => s.includes("Failed to auto-register"));
            expect(warnLogs.length).toBeGreaterThan(0);
            expect(warnLogs[0]).toContain("500");

            await app.close();
            stderrSpy.mockRestore();
            stdoutSpy.mockRestore();
        });

        it("should warn when POST throws a network error", async () => {
            const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
            const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

            fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

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

            const allOutput = [
                ...stderrSpy.mock.calls.map((c) => String(c[0])),
                ...stdoutSpy.mock.calls.map((c) => String(c[0])),
            ];
            const warnLogs = allOutput.filter((s) => s.includes("ECONNREFUSED"));
            expect(warnLogs.length).toBeGreaterThan(0);

            await app.close();
            stderrSpy.mockRestore();
            stdoutSpy.mockRestore();
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
            // Note: We only test metadata storage here, not full endpoint startup,
            // because the SDK validates identity key format (32-byte base58) at
            // endpoint construction time. Using a fake key with app.init() would throw.
            // Key forwarding to the endpoint is tested in restate.endpoint.spec.ts.
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

    describe("RestateContext provider", () => {
        it("should auto-register RestateContext in forRoot", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        endpoint: { port: 9080 },
                    }),
                ],
            }).compile();

            const ctx = module.get(RestateContext);
            expect(ctx).toBeInstanceOf(RestateContext);

            await module.close();
        });

        it("should auto-register RestateContext in forRootAsync", async () => {
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

            const ctx = module.get(RestateContext);
            expect(ctx).toBeInstanceOf(RestateContext);

            await module.close();
        });
    });

    describe("auto-discovered client proxies", () => {
        @Service("payment")
        class PaymentService {
            @Handler()
            async charge() {
                return "ok";
            }
        }

        @VirtualObject("cart")
        class CartObject {
            @Handler()
            async addItem() {}
        }

        @Workflow("signup")
        class SignupWorkflow {
            @Run()
            async run() {
                return "done";
            }
        }

        it("should auto-register proxy providers for all decorated components", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        endpoint: { port: 9080 },
                    }),
                ],
            }).compile();

            const paymentProxy = module.get(getClientToken(PaymentService));
            expect(paymentProxy).toBeDefined();

            const cartProxy = module.get(getClientToken(CartObject));
            expect(cartProxy).toBeDefined();

            const signupProxy = module.get(getClientToken(SignupWorkflow));
            expect(signupProxy).toBeDefined();

            await module.close();
        });

        it("should auto-register proxy providers with forRootAsync", async () => {
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

            const paymentProxy = module.get(getClientToken(PaymentService));
            expect(paymentProxy).toBeDefined();

            await module.close();
        });
    });
});
