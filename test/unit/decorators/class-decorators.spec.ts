import "reflect-metadata";
import { Service, VirtualObject, Workflow } from "../../../src/decorators/index";
import {
    SERVICE_METADATA_KEY,
    VIRTUAL_OBJECT_METADATA_KEY,
    WORKFLOW_METADATA_KEY,
} from "../../../src/restate.constants";

describe("Class Decorators", () => {
    describe("@Workflow", () => {
        it("should set workflow metadata with name", () => {
            @Workflow("my-workflow")
            class TestWorkflow {}

            const meta = Reflect.getMetadata(WORKFLOW_METADATA_KEY, TestWorkflow);
            expect(meta).toEqual({ name: "my-workflow" });
        });

        it("should make the class injectable", () => {
            @Workflow("test")
            class TestWorkflow {}

            const injectable = Reflect.getMetadata("__injectable__", TestWorkflow);
            expect(injectable).toBe(true);
        });
    });

    describe("@Service", () => {
        it("should set service metadata with name", () => {
            @Service("my-service")
            class TestService {}

            const meta = Reflect.getMetadata(SERVICE_METADATA_KEY, TestService);
            expect(meta).toEqual({ name: "my-service" });
        });

        it("should make the class injectable", () => {
            @Service("test")
            class TestService {}

            const injectable = Reflect.getMetadata("__injectable__", TestService);
            expect(injectable).toBe(true);
        });
    });

    describe("@VirtualObject", () => {
        it("should set virtual object metadata with name", () => {
            @VirtualObject("my-object")
            class TestObject {}

            const meta = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, TestObject);
            expect(meta).toEqual({ name: "my-object" });
        });

        it("should make the class injectable", () => {
            @VirtualObject("test")
            class TestObject {}

            const injectable = Reflect.getMetadata("__injectable__", TestObject);
            expect(injectable).toBe(true);
        });
    });
});
