import "reflect-metadata";
import { Test } from "@nestjs/testing";
import {
    type DeploymentMetadataChange,
    Handler,
    RestateModule,
    Run,
    Service,
    Workflow,
} from "nestjs-restate";
import { computeInterfaceHash } from "nestjs-restate/restate.module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("deployment change detection", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    const originalFetch = globalThis.fetch;

    @Workflow({ name: "order", metadata: { revision: "1" } })
    class OrderWorkflow {
        @Run()
        async run(_input: any) {
            return "done";
        }
    }

    @Service({ name: "payment", metadata: { version: "2.0" } })
    class PaymentService {
        @Handler()
        async charge() {
            return "ok";
        }
    }

    @Service("plain-svc")
    class PlainService {
        @Handler()
        async handle() {
            return "ok";
        }
    }

    beforeEach(() => {
        fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it("should store component metadata as JSON blob in deployment metadata", async () => {
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
                        deploymentUrl: "http://host:9080",
                    },
                }),
            ],
            providers: [OrderWorkflow, PaymentService, PlainService],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        const postCall = fetchSpy.mock.calls.find((c: any[]) => c[1]?.method === "POST");
        const body = JSON.parse(postCall?.[1].body);
        const componentMeta = JSON.parse(body.metadata["nestjs-restate.component-metadata"]);

        expect(componentMeta).toEqual({
            order: { revision: "1" },
            payment: { version: "2.0" },
        });
        // PlainService has no metadata — should not appear
        expect(componentMeta["plain-svc"]).toBeUndefined();

        await app.close();
    });

    it("should call onDeploymentMetadataChange with diff when metadata changes", async () => {
        const hookFn = vi.fn();

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.interface-hash": "sha256:old",
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "0" },
                                            payment: { version: "2.0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow, PaymentService],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        expect(hookFn).toHaveBeenCalledOnce();
        const [changes, admin] = hookFn.mock.calls[0];

        // Only "order" changed (revision "0" → "1"); "payment" unchanged
        expect(changes).toEqual([
            {
                serviceName: "order",
                type: "workflow",
                oldMetadata: { revision: "0" },
                newMetadata: { revision: "1" },
            },
        ]);
        expect(admin).toEqual({ url: "http://localhost:9070", authToken: undefined });

        await app.close();
    });

    it("should detect new components (oldMetadata null)", async () => {
        const hookFn = vi.fn();

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({}),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        expect(hookFn).toHaveBeenCalledOnce();
        const [changes] = hookFn.mock.calls[0];
        expect(changes).toEqual([
            {
                serviceName: "order",
                type: "workflow",
                oldMetadata: null,
                newMetadata: { revision: "1" },
            },
        ]);

        await app.close();
    });

    it("should detect removed components (newMetadata null)", async () => {
        const hookFn = vi.fn();

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "1" },
                                            "removed-wf": { revision: "3" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        expect(hookFn).toHaveBeenCalledOnce();
        const [changes] = hookFn.mock.calls[0];
        const removedChange = changes.find(
            (c: DeploymentMetadataChange) => c.serviceName === "removed-wf",
        );
        expect(removedChange).toEqual({
            serviceName: "removed-wf",
            type: "unknown",
            oldMetadata: { revision: "3" },
            newMetadata: null,
        });

        await app.close();
    });

    it("should not call hook when no metadata changes", async () => {
        const hookFn = vi.fn();

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "1" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        expect(hookFn).not.toHaveBeenCalled();

        await app.close();
    });

    it("should abort registration when hook throws", async () => {
        const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: () => {
                            throw new Error("Deployment blocked!");
                        },
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        // No POST call should have been made
        const postCalls = fetchSpy.mock.calls.filter((c: any[]) => c[1]?.method === "POST");
        expect(postCalls).toHaveLength(0);

        await app.close();
        stderrSpy.mockRestore();
    });

    it("should skip hook and proceed when GET /deployments fails", async () => {
        const hookFn = vi.fn();

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                throw new Error("ECONNREFUSED");
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        // Hook not called because GET failed
        expect(hookFn).not.toHaveBeenCalled();
        // POST still happened
        const postCalls = fetchSpy.mock.calls.filter((c: any[]) => c[1]?.method === "POST");
        expect(postCalls).toHaveLength(1);

        await app.close();
    });

    it("should bypass production skip-check when metadata changed", async () => {
        const hookFn = vi.fn();

        // Compute the REAL hash for the OrderWorkflow so that the
        // production pre-check would normally SKIP the POST
        const realHash = computeInterfaceHash([
            {
                componentName: "order",
                componentType: "workflow",
                handlers: [{ name: "run", type: "run" }],
            },
        ]);

        // Return old deployment with SAME interface hash but DIFFERENT metadata
        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.interface-hash": realHash,
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        mode: "production",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        // Hook should have been called (metadata changed)
        expect(hookFn).toHaveBeenCalledOnce();
        // POST should have happened despite production mode and matching hash
        // (because metadata changed, skip-check is bypassed)
        const postCalls = fetchSpy.mock.calls.filter((c: any[]) => c[1]?.method === "POST");
        expect(postCalls).toHaveLength(1);
        // force must be true so Restate re-registers with updated metadata
        const postBody = JSON.parse(postCalls[0][1].body);
        expect(postBody.force).toBe(true);

        await app.close();
    });

    it("should pass admin config with authToken to hook", async () => {
        const hookFn = vi.fn();

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: { url: "http://localhost:9070", authToken: "secret" },
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        expect(hookFn).toHaveBeenCalledOnce();
        const [, admin] = hookFn.mock.calls[0];
        expect(admin).toEqual({ url: "http://localhost:9070", authToken: "secret" });

        await app.close();
    });

    it("should fire GET /deployments even in dev mode when hook is configured", async () => {
        const hookFn = vi.fn();

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        // mode defaults to 'development'
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        // GET was called (for hook diff) even though mode is development
        const getCalls = fetchSpy.mock.calls.filter(
            (c: any[]) => !c[1]?.method || c[1].method === "GET",
        );
        expect(getCalls.length).toBeGreaterThanOrEqual(1);

        // Hook was called (metadata changed: old revision "0" → new "1")
        expect(hookFn).toHaveBeenCalledOnce();

        await app.close();
    });

    it("should re-register in production mode when metadata changed even without hook", async () => {
        // Compute the REAL hash so the production pre-check would normally skip
        const realHash = computeInterfaceHash([
            {
                componentName: "order",
                componentType: "workflow",
                handlers: [{ name: "run", type: "run" }],
            },
        ]);

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.interface-hash": realHash,
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        mode: "production",
                        // No onDeploymentMetadataChange hook configured
                    },
                }),
            ],
            providers: [OrderWorkflow],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        // POST should happen — metadata changed even though hash matches and no hook
        const postCalls = fetchSpy.mock.calls.filter((c: any[]) => c[1]?.method === "POST");
        expect(postCalls).toHaveLength(1);
        // force must be true to persist updated metadata
        const postBody = JSON.parse(postCalls[0][1].body);
        expect(postBody.force).toBe(true);

        await app.close();
    });

    it("should not trigger hook when metadata keys are reordered", async () => {
        const hookFn = vi.fn();

        // Old metadata has keys in one order, new metadata has them in another
        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080",
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "1" },
                                            payment: { team: "billing", version: "2.0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        @Service({ name: "payment", metadata: { version: "2.0", team: "billing" } })
        class PaymentReordered {
            @Handler()
            async charge() {
                return "ok";
            }
        }

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow, PaymentReordered],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        // Hook should not be called: metadata is semantically identical despite key reordering
        expect(hookFn).not.toHaveBeenCalled();

        await app.close();
    });

    it("should match existing deployment when Restate adds trailing slash to URI", async () => {
        const hookFn = vi.fn();

        // Restate returns URI with trailing slash, but config has no trailing slash
        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080/", // trailing slash from Restate
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "1" },
                                            payment: { version: "2.0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080", // no trailing slash
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow, PaymentService],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        // Hook should NOT be called — metadata matches, URI trailing slash shouldn't matter
        expect(hookFn).not.toHaveBeenCalled();

        await app.close();
    });

    it("should detect real changes even when Restate URI has trailing slash", async () => {
        const hookFn = vi.fn();

        fetchSpy.mockImplementation(async (_url: string, opts?: any) => {
            if (!opts?.method || opts.method === "GET") {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            deployments: [
                                {
                                    uri: "http://host:9080/", // trailing slash
                                    metadata: {
                                        "nestjs-restate.component-metadata": JSON.stringify({
                                            order: { revision: "0" }, // old revision
                                            payment: { version: "2.0" },
                                        }),
                                    },
                                },
                            ],
                        }),
                };
            }
            return { ok: true, status: 201, text: () => Promise.resolve("") };
        });

        const module = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://localhost:8080",
                    admin: "http://localhost:9070",
                    endpoint: { port: 0 },
                    autoRegister: {
                        deploymentUrl: "http://host:9080",
                        onDeploymentMetadataChange: hookFn,
                    },
                }),
            ],
            providers: [OrderWorkflow, PaymentService],
        }).compile();

        const app = module.createNestApplication();
        await app.init();

        // Hook should be called with the actual change (order revision 0 → 1)
        expect(hookFn).toHaveBeenCalledOnce();
        const [changes] = hookFn.mock.calls[0];
        expect(changes).toHaveLength(1);
        expect(changes[0].serviceName).toBe("order");
        expect(changes[0].oldMetadata).toEqual({ revision: "0" });
        expect(changes[0].newMetadata).toEqual({ revision: "1" });

        await app.close();
    });
});
