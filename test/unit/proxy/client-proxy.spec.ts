import "reflect-metadata";
import { Service, VirtualObject, Workflow } from "nestjs-restate";
import { runWithContext } from "nestjs-restate/context/restate-context.store";
import { createClientProxy } from "nestjs-restate/proxy/client-proxy";
import { describe, expect, it, vi } from "vitest";

// ── Test fixtures ──

@Service("payment")
class PaymentService {
    async charge(req: { amount: number }): Promise<string> {
        return "pay-ref";
    }
}

@VirtualObject("cart")
class CartObject {
    async addItem(item: { name: string }): Promise<void> {}
    async getItems(): Promise<string[]> {
        return [];
    }
}

@Workflow("signup")
class SignupWorkflow {
    async run(input: { email: string }): Promise<string> {
        return "done";
    }
    async getStatus(): Promise<string> {
        return "pending";
    }
}

class NotDecorated {
    async doSomething(): Promise<void> {}
}

describe("createClientProxy", () => {
    describe("error cases", () => {
        it("should throw for class without Restate decorator", () => {
            expect(() => createClientProxy(NotDecorated)).toThrow(
                /has no Restate component decorator/,
            );
        });

        it("should throw with helpful message suggesting decorators", () => {
            expect(() => createClientProxy(NotDecorated)).toThrow(
                /@Service\(\)|@VirtualObject\(\)|@Workflow\(\)/,
            );
        });
    });

    describe("ServiceClient proxy", () => {
        it("should create a proxy for @Service classes", () => {
            const proxy = createClientProxy(PaymentService);
            expect(proxy).toBeDefined();
        });

        it("should call ctx.serviceClient for method invocations", async () => {
            const proxy = createClientProxy(PaymentService);
            const mockServiceClient = { charge: vi.fn().mockResolvedValue("pay-123") };
            const mockCtx = {
                serviceClient: vi.fn().mockReturnValue(mockServiceClient),
            };

            const result = await runWithContext(mockCtx, () => proxy.charge({ amount: 100 }));

            expect(mockCtx.serviceClient).toHaveBeenCalledWith({ name: "payment" });
            expect(mockServiceClient.charge).toHaveBeenCalledWith({ amount: 100 });
            expect(result).toBe("pay-123");
        });

        it("should support .send for fire-and-forget calls", () => {
            const proxy = createClientProxy(PaymentService);
            const mockHandle = { invocationId: "inv-1" };
            const mockSendClient = { charge: vi.fn().mockReturnValue(mockHandle) };
            const mockCtx = {
                serviceSendClient: vi.fn().mockReturnValue(mockSendClient),
            };

            const result = runWithContext(mockCtx, () => proxy.send.charge({ amount: 50 }));

            expect(mockCtx.serviceSendClient).toHaveBeenCalledWith({ name: "payment" });
            expect(mockSendClient.charge).toHaveBeenCalledWith({ amount: 50 });
            expect(result).toBe(mockHandle);
        });

        it("should support .send with SendOpts", () => {
            const proxy = createClientProxy(PaymentService);
            const mockSendClient = { charge: vi.fn() };
            const mockCtx = {
                serviceSendClient: vi.fn().mockReturnValue(mockSendClient),
            };
            const mockOpts = { delay: 1000 };

            runWithContext(mockCtx, () => proxy.send.charge({ amount: 50 }, mockOpts));

            expect(mockSendClient.charge).toHaveBeenCalledWith({ amount: 50 }, mockOpts);
        });
    });

    describe("ObjectClient proxy", () => {
        it("should require .key() before calling methods", () => {
            const proxy = createClientProxy(CartObject);
            expect(proxy.key).toBeDefined();
            expect(typeof proxy.key).toBe("function");
        });

        it("should call ctx.objectClient with key for method invocations", async () => {
            const proxy = createClientProxy(CartObject);
            const mockObjectClient = { addItem: vi.fn().mockResolvedValue(undefined) };
            const mockCtx = {
                objectClient: vi.fn().mockReturnValue(mockObjectClient),
            };

            await runWithContext(mockCtx, () => proxy.key("user-123").addItem({ name: "widget" }));

            expect(mockCtx.objectClient).toHaveBeenCalledWith({ name: "cart" }, "user-123");
            expect(mockObjectClient.addItem).toHaveBeenCalledWith({ name: "widget" });
        });

        it("should support .key().send for fire-and-forget", () => {
            const proxy = createClientProxy(CartObject);
            const mockHandle = { invocationId: "inv-2" };
            const mockSendClient = { addItem: vi.fn().mockReturnValue(mockHandle) };
            const mockCtx = {
                objectSendClient: vi.fn().mockReturnValue(mockSendClient),
            };

            const result = runWithContext(mockCtx, () =>
                proxy.key("user-456").send.addItem({ name: "gizmo" }),
            );

            expect(mockCtx.objectSendClient).toHaveBeenCalledWith({ name: "cart" }, "user-456");
            expect(result).toBe(mockHandle);
        });
    });

    describe("WorkflowClient proxy", () => {
        it("should require .key() before calling methods", () => {
            const proxy = createClientProxy(SignupWorkflow);
            expect(typeof proxy.key).toBe("function");
        });

        it("should call ctx.workflowClient with key for method invocations", async () => {
            const proxy = createClientProxy(SignupWorkflow);
            const mockWorkflowClient = { run: vi.fn().mockResolvedValue("completed") };
            const mockCtx = {
                workflowClient: vi.fn().mockReturnValue(mockWorkflowClient),
            };

            const result = await runWithContext(mockCtx, () =>
                proxy.key("wf-789").run({ email: "a@b.com" }),
            );

            expect(mockCtx.workflowClient).toHaveBeenCalledWith({ name: "signup" }, "wf-789");
            expect(result).toBe("completed");
        });

        it("should support .key().send for fire-and-forget", () => {
            const proxy = createClientProxy(SignupWorkflow);
            const mockHandle = { invocationId: "inv-3" };
            const mockSendClient = { run: vi.fn().mockReturnValue(mockHandle) };
            const mockCtx = {
                workflowSendClient: vi.fn().mockReturnValue(mockSendClient),
            };

            const result = runWithContext(mockCtx, () =>
                proxy.key("wf-000").send.run({ email: "b@c.com" }),
            );

            expect(mockCtx.workflowSendClient).toHaveBeenCalledWith({ name: "signup" }, "wf-000");
            expect(result).toBe(mockHandle);
        });
    });

    describe("PASSTHROUGH_PROPS guard", () => {
        it("should return undefined for 'then' (prevents thenable detection)", () => {
            const proxy = createClientProxy(PaymentService);
            expect((proxy as any).then).toBeUndefined();
        });

        it("should return undefined for 'catch'", () => {
            const proxy = createClientProxy(PaymentService);
            expect((proxy as any).catch).toBeUndefined();
        });

        it("should return undefined for 'finally'", () => {
            const proxy = createClientProxy(PaymentService);
            expect((proxy as any).finally).toBeUndefined();
        });

        it("should return undefined for 'toJSON'", () => {
            const proxy = createClientProxy(PaymentService);
            expect((proxy as any).toJSON).toBeUndefined();
        });

        it("should return undefined for 'valueOf'", () => {
            const proxy = createClientProxy(PaymentService);
            expect((proxy as any).valueOf).toBeUndefined();
        });

        it("should return undefined for symbol properties", () => {
            const proxy = createClientProxy(PaymentService);
            expect((proxy as any)[Symbol.toPrimitive]).toBeUndefined();
        });

        it("should be safely awaitable without hanging", async () => {
            const proxy = createClientProxy(PaymentService);
            // This should resolve to the proxy itself, not hang
            const result = await proxy;
            expect(result).toBeDefined();
        });

        it("should guard .send proxy against thenable detection", () => {
            const proxy = createClientProxy(PaymentService);
            // Access .send outside of a handler context — it's just the proxy object
            // The 'then' trap should still return undefined
            const sendProxy = runWithContext({}, () => proxy.send);
            expect((sendProxy as any).then).toBeUndefined();
        });

        it("should guard .key() result against thenable detection", () => {
            const proxy = createClientProxy(CartObject);
            const keyed = proxy.key("test");
            expect((keyed as any).then).toBeUndefined();
        });
    });
});
