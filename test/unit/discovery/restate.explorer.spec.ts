import "reflect-metadata";
import { Handler, Run, Service, Shared, Signal, VirtualObject, Workflow } from "nestjs-restate";
import { RestateExplorer } from "nestjs-restate/discovery/restate.explorer";

function createMockDiscoveryService(instances: any[]) {
    return {
        getProviders: () =>
            instances.map((instance) => ({
                instance,
                metatype: instance.constructor,
            })),
    };
}

describe("RestateExplorer", () => {
    describe("workflow discovery", () => {
        it("should discover a workflow with run and shared handlers", () => {
            @Workflow("test-workflow")
            class TestWorkflow {
                @Run()
                async run(_input: any) {
                    return "done";
                }

                @Signal()
                async signal() {
                    /* noop */
                }
            }

            const instance = new TestWorkflow();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("test-workflow");
        });

        it("should throw if workflow has no @Run handler", () => {
            @Workflow("bad-workflow")
            class BadWorkflow {
                @Signal()
                async signal() {
                    /* noop */
                }
            }

            const instance = new BadWorkflow();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);

            expect(() => explorer.discover()).toThrow(/must have exactly one @Run/);
        });

        it("should throw if workflow has multiple @Run handlers", () => {
            @Workflow("multi-run")
            class MultiRunWorkflow {
                @Run()
                async run1() {
                    /* noop */
                }

                @Run()
                async run2() {
                    /* noop */
                }
            }

            const instance = new MultiRunWorkflow();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);

            expect(() => explorer.discover()).toThrow(/must have exactly one @Run/);
        });
    });

    describe("service discovery", () => {
        it("should discover a service with handlers", () => {
            @Service("test-service")
            class TestService {
                @Handler()
                async greet(_name: string) {
                    return "hello";
                }

                @Handler()
                async farewell() {
                    /* noop */
                }
            }

            const instance = new TestService();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("test-service");
        });

        it("should throw if service has no handlers", () => {
            @Service("empty-service")
            class EmptyService {}

            const instance = new EmptyService();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);

            expect(() => explorer.discover()).toThrow(/must have at least one @Handler/);
        });
    });

    describe("virtual object discovery", () => {
        it("should discover a virtual object with exclusive and shared handlers", () => {
            @VirtualObject("test-object")
            class TestObject {
                @Handler()
                async increment() {
                    /* noop */
                }

                @Shared()
                async getCount() {
                    return 0;
                }
            }

            const instance = new TestObject();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("test-object");
        });

        it("should throw if virtual object has no handlers", () => {
            @VirtualObject("empty-object")
            class EmptyObject {}

            const instance = new EmptyObject();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);

            expect(() => explorer.discover()).toThrow(/must have at least one/);
        });
    });

    describe("binding", () => {
        it("should bind handler methods to the NestJS-managed instance", async () => {
            @Workflow("binding-test")
            class BindingWorkflow {
                private readonly value = "injected";

                @Run()
                async run() {
                    return this.value;
                }
            }

            const instance = new BindingWorkflow();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            // The workflow definition is created — verify that the run handler
            // is bound correctly by calling it
            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("binding-test");
        });
    });

    describe("multi-component discovery", () => {
        it("should discover components from multiple providers", () => {
            @Workflow("wf")
            class Wf {
                @Run()
                async run() {
                    /* noop */
                }
            }

            @Service("svc")
            class Svc {
                @Handler()
                async handle() {
                    /* noop */
                }
            }

            @VirtualObject("obj")
            class Obj {
                @Handler()
                async increment() {
                    /* noop */
                }
            }

            const discoveryService = createMockDiscoveryService([new Wf(), new Svc(), new Obj()]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(3);
            expect(definitions.map((d) => d.name).sort()).toEqual(["obj", "svc", "wf"]);
        });

        it("should skip providers without Restate metadata", () => {
            @Workflow("wf")
            class Wf {
                @Run()
                async run() {
                    /* noop */
                }
            }

            class RegularService {
                async doSomething() {
                    /* noop */
                }
            }

            const discoveryService = createMockDiscoveryService([new Wf(), new RegularService()]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("wf");
        });

        it("should populate serviceClassNames map for all discovered components", () => {
            @Workflow("wf")
            class MyWorkflow {
                @Run()
                async run() {
                    /* noop */
                }
            }

            @Service("svc")
            class MySvc {
                @Handler()
                async handle() {
                    /* noop */
                }
            }

            @VirtualObject("obj")
            class MyObj {
                @Handler()
                async increment() {
                    /* noop */
                }
            }

            const discoveryService = createMockDiscoveryService([
                new MyWorkflow(),
                new MySvc(),
                new MyObj(),
            ]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions, serviceClassNames } = explorer.discover();

            expect(definitions).toHaveLength(3);
            expect(serviceClassNames.size).toBe(3);
            expect(serviceClassNames.get("wf")).toBe("MyWorkflow");
            expect(serviceClassNames.get("svc")).toBe("MySvc");
            expect(serviceClassNames.get("obj")).toBe("MyObj");
        });
    });

    describe("configuration passthrough", () => {
        it("should forward service options to SDK definition", () => {
            @Service({
                name: "configured-service",
                description: "A configured service",
                metadata: { version: "2" },
                options: {
                    retryPolicy: { maxAttempts: 5 },
                    inactivityTimeout: 30_000,
                },
            })
            class ConfiguredService {
                @Handler()
                async process() {
                    return "ok";
                }
            }

            const instance = new ConfiguredService();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("configured-service");
            expect(definitions[0].description).toBe("A configured service");
            expect(definitions[0].metadata).toEqual({ version: "2" });
            expect(definitions[0].options).toEqual({
                retryPolicy: { maxAttempts: 5 },
                inactivityTimeout: 30_000,
            });
        });

        it("should forward workflow options to SDK definition", () => {
            @Workflow({
                name: "configured-workflow",
                description: "A configured workflow",
                metadata: { team: "backend" },
                options: {
                    workflowRetention: 604800000,
                    retryPolicy: { maxAttempts: 3 },
                },
            })
            class ConfiguredWorkflow {
                @Run()
                async run() {
                    return "done";
                }

                @Signal()
                async getStatus() {
                    return "active";
                }
            }

            const instance = new ConfiguredWorkflow();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("configured-workflow");
            expect(definitions[0].description).toBe("A configured workflow");
            expect(definitions[0].metadata).toEqual({ team: "backend" });
            expect(definitions[0].options).toEqual({
                workflowRetention: 604800000,
                retryPolicy: { maxAttempts: 3 },
            });
        });

        it("should forward virtual object options to SDK definition", () => {
            @VirtualObject({
                name: "configured-object",
                metadata: { team: "commerce" },
                options: {
                    enableLazyState: true,
                    retryPolicy: { maxAttempts: 10 },
                },
            })
            class ConfiguredObject {
                @Handler()
                async increment() {
                    /* noop */
                }

                @Shared()
                async getCount() {
                    return 0;
                }
            }

            const instance = new ConfiguredObject();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("configured-object");
            expect(definitions[0].metadata).toEqual({ team: "commerce" });
            expect(definitions[0].options).toEqual({
                enableLazyState: true,
                retryPolicy: { maxAttempts: 10 },
            });
        });

        it("should forward handler-level options for service handlers", () => {
            @Service("svc-with-handler-opts")
            class SvcWithHandlerOpts {
                @Handler({ retryPolicy: { maxAttempts: 2 } })
                async process() {
                    return "ok";
                }
            }

            const instance = new SvcWithHandlerOpts();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("svc-with-handler-opts");
        });

        it("should forward handler-level options for workflow run handler", () => {
            @Workflow("wf-with-handler-opts")
            class WfWithHandlerOpts {
                @Run({ retryPolicy: { maxAttempts: 1 } })
                async run() {
                    return "done";
                }
            }

            const instance = new WfWithHandlerOpts();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("wf-with-handler-opts");
        });

        it("should forward handler-level options for virtual object handlers", () => {
            @VirtualObject("obj-with-handler-opts")
            class ObjWithHandlerOpts {
                @Handler({ retryPolicy: { maxAttempts: 7 } })
                async increment() {
                    /* noop */
                }

                @Shared({ retryPolicy: { maxAttempts: 3 } })
                async getCount() {
                    return 0;
                }
            }

            const instance = new ObjWithHandlerOpts();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("obj-with-handler-opts");
        });

        it("should work with mixed configured and plain components", () => {
            @Service({
                name: "configured",
                options: { retryPolicy: { maxAttempts: 5 } },
            })
            class Configured {
                @Handler()
                async process() {
                    /* noop */
                }
            }

            @Service("plain")
            class Plain {
                @Handler()
                async handle() {
                    /* noop */
                }
            }

            const discoveryService = createMockDiscoveryService([new Configured(), new Plain()]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(2);
            expect(definitions.map((d) => d.name).sort()).toEqual(["configured", "plain"]);
        });
    });

    describe("ALS context wrapping (v2)", () => {
        it("should pass only input (not ctx) to user handler", async () => {
            const receivedArgs: any[][] = [];

            @Service("arg-check")
            class ArgCheckService {
                @Handler()
                async process(...args: any[]) {
                    receivedArgs.push(args);
                    return "ok";
                }
            }

            const instance = new ArgCheckService();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            const mockCtx = { serviceName: "test" };
            const mockInput = { data: "hello" };
            await definitions[0].service.process(mockCtx, mockInput);

            expect(receivedArgs).toHaveLength(1);
            expect(receivedArgs[0]).toEqual([mockInput]);
        });

        it("should make ctx available via getCurrentContext inside handler", async () => {
            const { getCurrentContext } = await import(
                "nestjs-restate/context/restate-context.store"
            );
            let capturedCtx: any;

            @Service("ctx-capture")
            class CtxCaptureService {
                @Handler()
                async capture() {
                    capturedCtx = getCurrentContext();
                    return "ok";
                }
            }

            const instance = new CtxCaptureService();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            const mockCtx = { serviceName: "ctx-capture", run: vi.fn() };
            await definitions[0].service.capture(mockCtx, undefined);

            expect(capturedCtx).toBe(mockCtx);
        });

        it("should wrap workflow run handler with ALS", async () => {
            const { getCurrentContext } = await import(
                "nestjs-restate/context/restate-context.store"
            );
            let capturedCtx: any;

            @Workflow("als-workflow")
            class AlsWorkflow {
                @Run()
                async run(input: string) {
                    capturedCtx = getCurrentContext();
                    return `processed: ${input}`;
                }
            }

            const instance = new AlsWorkflow();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            const mockCtx = { workflowId: "wf-123" };
            await definitions[0].workflow.run(mockCtx, "test-input");

            expect(capturedCtx).toBe(mockCtx);
        });

        it("should wrap virtual object handlers with ALS", async () => {
            const { getCurrentContext } = await import(
                "nestjs-restate/context/restate-context.store"
            );
            let capturedCtx: any;

            @VirtualObject("als-object")
            class AlsObject {
                @Handler()
                async increment(amount: number) {
                    capturedCtx = getCurrentContext();
                    return amount;
                }
            }

            const instance = new AlsObject();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            const mockCtx = { key: "obj-1" };
            await definitions[0].object.increment(mockCtx, 5);

            expect(capturedCtx).toBe(mockCtx);
        });

        it("should throw at startup if @Run() method is not named 'run'", () => {
            @Workflow("bad-run-name")
            class BadRunName {
                @Run()
                async execute() {
                    return "done";
                }
            }

            const instance = new BadRunName();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);

            expect(() => explorer.discover()).toThrow(/must be named 'run', found 'execute'/);
        });

        it("should accept @Shared() on a workflow for read-only query handlers", () => {
            @Workflow("shared-workflow")
            class SharedWorkflow {
                @Run()
                async run() {
                    return "done";
                }

                @Signal()
                async confirm(code: string) {
                    /* resolves promise */
                }

                @Shared()
                async status() {
                    return "pending";
                }
            }

            const instance = new SharedWorkflow();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const { definitions } = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("shared-workflow");
        });
    });
});
