import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { RestateExecutionContext } from "nestjs-restate/pipeline/restate-execution-context";

describe("RestateExecutionContext", () => {
    const mockRestateCtx = { serviceName: "test-service" };
    const mockInput = { key: "value" };
    const mockClass = class TestHandler {};
    const mockHandler = () => {};

    function createHost(type = "restate") {
        const host = new ExecutionContextHost(
            [mockInput, mockRestateCtx],
            mockClass,
            mockHandler as any,
        );
        host.setType(type);
        return host;
    }

    describe("create()", () => {
        it("should create an instance from an ExecutionContext", () => {
            const host = createHost();
            const ctx = RestateExecutionContext.create(host);
            expect(ctx).toBeInstanceOf(RestateExecutionContext);
            expect(ctx).toBeInstanceOf(ExecutionContextHost);
        });
    });

    describe("getRestateContext()", () => {
        it("should return args[1]", () => {
            const ctx = RestateExecutionContext.create(createHost());
            expect(ctx.getRestateContext()).toBe(mockRestateCtx);
        });
    });

    describe("getInput()", () => {
        it("should return args[0]", () => {
            const ctx = RestateExecutionContext.create(createHost());
            expect(ctx.getInput()).toBe(mockInput);
        });
    });

    describe("getType()", () => {
        it("should preserve the type from the original context", () => {
            const ctx = RestateExecutionContext.create(createHost("http"));
            expect(ctx.getType()).toBe("http");
        });

        it("should work with 'restate' context type", () => {
            const ctx = RestateExecutionContext.create(createHost("restate"));
            expect(ctx.getType()).toBe("restate");
        });
    });

    describe("getClass()", () => {
        it("should preserve the class from the original context", () => {
            const ctx = RestateExecutionContext.create(createHost());
            expect(ctx.getClass()).toBe(mockClass);
        });
    });

    describe("getHandler()", () => {
        it("should preserve the handler from the original context", () => {
            const ctx = RestateExecutionContext.create(createHost());
            expect(ctx.getHandler()).toBe(mockHandler);
        });
    });
});
