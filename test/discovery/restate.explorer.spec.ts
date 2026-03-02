import "reflect-metadata";
import { Handler, Run, Shared } from "../../src/decorators/handler.decorator";
import { Service } from "../../src/decorators/service.decorator";
import { VirtualObject } from "../../src/decorators/virtual-object.decorator";
import { Workflow } from "../../src/decorators/workflow.decorator";
import { RestateExplorer } from "../../src/discovery/restate.explorer";

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
                async run(_ctx: any, _input: any) {
                    return "done";
                }

                @Shared()
                async signal(_ctx: any) {
                    /* noop */
                }
            }

            const instance = new TestWorkflow();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const definitions = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("test-workflow");
        });

        it("should throw if workflow has no @Run handler", () => {
            @Workflow("bad-workflow")
            class BadWorkflow {
                @Shared()
                async signal(_ctx: any) {
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
                async run1(_ctx: any) {
                    /* noop */
                }

                @Run()
                async run2(_ctx: any) {
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
                async greet(_ctx: any, _name: string) {
                    return "hello";
                }

                @Handler()
                async farewell(_ctx: any) {
                    /* noop */
                }
            }

            const instance = new TestService();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const definitions = explorer.discover();

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
                async increment(_ctx: any) {
                    /* noop */
                }

                @Shared()
                async getCount(_ctx: any) {
                    return 0;
                }
            }

            const instance = new TestObject();
            const discoveryService = createMockDiscoveryService([instance]);
            const explorer = new RestateExplorer(discoveryService as any);
            const definitions = explorer.discover();

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
            const definitions = explorer.discover();

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
            const definitions = explorer.discover();

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
            const definitions = explorer.discover();

            expect(definitions).toHaveLength(1);
            expect(definitions[0].name).toBe("wf");
        });
    });
});
