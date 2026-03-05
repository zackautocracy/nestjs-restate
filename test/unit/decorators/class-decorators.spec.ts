import "reflect-metadata";
import { Service, VirtualObject, Workflow } from "nestjs-restate";
import {
    SERVICE_METADATA_KEY,
    VIRTUAL_OBJECT_METADATA_KEY,
    WORKFLOW_METADATA_KEY,
} from "nestjs-restate/restate.constants";

describe("Class Decorators", () => {
    describe("@Workflow", () => {
        it("should set workflow metadata with name", () => {
            @Workflow("my-workflow")
            class TestWorkflow {}

            const meta = Reflect.getMetadata(WORKFLOW_METADATA_KEY, TestWorkflow);
            expect(meta).toEqual({ name: "my-workflow" });
        });

        it("should default name to class name when called without arguments", () => {
            @Workflow()
            class MyWorkflow {}

            const meta = Reflect.getMetadata(WORKFLOW_METADATA_KEY, MyWorkflow);
            expect(meta.name).toBe("MyWorkflow");
        });

        it("should make the class injectable", () => {
            @Workflow("test")
            class TestWorkflow {}

            const injectable = Reflect.getMetadata("__injectable__", TestWorkflow);
            expect(injectable).toBe(true);
        });

        it("should accept full options object with workflowRetention", () => {
            @Workflow({
                name: "signup",
                description: "User signup flow",
                metadata: { version: "1" },
                options: {
                    workflowRetention: 7 * 24 * 60 * 60 * 1000,
                    retryPolicy: { maxAttempts: 3 },
                    enableLazyState: true,
                },
            })
            class SignupWorkflow {}

            const meta = Reflect.getMetadata(WORKFLOW_METADATA_KEY, SignupWorkflow);
            expect(meta.name).toBe("signup");
            expect(meta.description).toBe("User signup flow");
            expect(meta.metadata).toEqual({ version: "1" });
            expect(meta.options?.workflowRetention).toBe(604800000);
            expect(meta.options?.retryPolicy?.maxAttempts).toBe(3);
            expect(meta.options?.enableLazyState).toBe(true);
        });
    });

    describe("@Service", () => {
        it("should set service metadata with name", () => {
            @Service("my-service")
            class TestService {}

            const meta = Reflect.getMetadata(SERVICE_METADATA_KEY, TestService);
            expect(meta).toEqual({ name: "my-service" });
        });

        it("should default name to class name when called without arguments", () => {
            @Service()
            class MyService {}

            const meta = Reflect.getMetadata(SERVICE_METADATA_KEY, MyService);
            expect(meta.name).toBe("MyService");
        });

        it("should make the class injectable", () => {
            @Service("test")
            class TestService {}

            const injectable = Reflect.getMetadata("__injectable__", TestService);
            expect(injectable).toBe(true);
        });

        it("should accept full options object with retryPolicy", () => {
            @Service({
                name: "payments",
                description: "Payment processing",
                options: {
                    retryPolicy: {
                        maxAttempts: 5,
                        initialInterval: 200,
                        maxInterval: 10_000,
                        exponentiationFactor: 2,
                    },
                    inactivityTimeout: 30_000,
                    abortTimeout: 60_000,
                    ingressPrivate: true,
                },
            })
            class PaymentService {}

            const meta = Reflect.getMetadata(SERVICE_METADATA_KEY, PaymentService);
            expect(meta.name).toBe("payments");
            expect(meta.description).toBe("Payment processing");
            expect(meta.options?.retryPolicy?.maxAttempts).toBe(5);
            expect(meta.options?.inactivityTimeout).toBe(30_000);
            expect(meta.options?.ingressPrivate).toBe(true);
        });

        it("should default name to class name when options object omits name", () => {
            @Service({
                options: {
                    retryPolicy: { maxAttempts: 3 },
                },
            })
            class AutoNamedService {}

            const meta = Reflect.getMetadata(SERVICE_METADATA_KEY, AutoNamedService);
            expect(meta.name).toBe("AutoNamedService");
            expect(meta.options?.retryPolicy?.maxAttempts).toBe(3);
        });
    });

    describe("@VirtualObject", () => {
        it("should set virtual object metadata with name", () => {
            @VirtualObject("my-object")
            class TestObject {}

            const meta = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, TestObject);
            expect(meta).toEqual({ name: "my-object" });
        });

        it("should default name to class name when called without arguments", () => {
            @VirtualObject()
            class MyObject {}

            const meta = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, MyObject);
            expect(meta.name).toBe("MyObject");
        });

        it("should make the class injectable", () => {
            @VirtualObject("test")
            class TestObject {}

            const injectable = Reflect.getMetadata("__injectable__", TestObject);
            expect(injectable).toBe(true);
        });

        it("should accept full options object with enableLazyState", () => {
            @VirtualObject({
                name: "cart",
                metadata: { team: "commerce" },
                options: {
                    enableLazyState: true,
                    retryPolicy: { maxAttempts: 10, onMaxAttempts: "pause" },
                },
            })
            class CartObject {}

            const meta = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, CartObject);
            expect(meta.name).toBe("cart");
            expect(meta.metadata).toEqual({ team: "commerce" });
            expect(meta.options?.enableLazyState).toBe(true);
            expect(meta.options?.retryPolicy?.onMaxAttempts).toBe("pause");
        });
    });

    describe("shared options mutation safety", () => {
        it("should not mutate a shared options object across @Service decorators", () => {
            const shared = { options: { retryPolicy: { maxAttempts: 5 } } };

            @Service(shared)
            class Foo {}

            @Service(shared)
            class Bar {}

            const fooMeta = Reflect.getMetadata(SERVICE_METADATA_KEY, Foo);
            const barMeta = Reflect.getMetadata(SERVICE_METADATA_KEY, Bar);

            expect(fooMeta.name).toBe("Foo");
            expect(barMeta.name).toBe("Bar");
            expect(shared).not.toHaveProperty("name");
        });

        it("should not mutate a shared options object across @Workflow decorators", () => {
            const shared = { options: { retryPolicy: { maxAttempts: 3 } } };

            @Workflow(shared)
            class Alpha {}

            @Workflow(shared)
            class Beta {}

            const alphaMeta = Reflect.getMetadata(WORKFLOW_METADATA_KEY, Alpha);
            const betaMeta = Reflect.getMetadata(WORKFLOW_METADATA_KEY, Beta);

            expect(alphaMeta.name).toBe("Alpha");
            expect(betaMeta.name).toBe("Beta");
            expect(shared).not.toHaveProperty("name");
        });

        it("should not mutate a shared options object across @VirtualObject decorators", () => {
            const shared = { options: { enableLazyState: true } };

            @VirtualObject(shared)
            class One {}

            @VirtualObject(shared)
            class Two {}

            const oneMeta = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, One);
            const twoMeta = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, Two);

            expect(oneMeta.name).toBe("One");
            expect(twoMeta.name).toBe("Two");
            expect(shared).not.toHaveProperty("name");
        });
    });
});
