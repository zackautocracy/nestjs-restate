import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { Service, VirtualObject, Workflow } from "nestjs-restate";
import { runWithContext } from "nestjs-restate/context/restate-context.store";
import { clearIngressWarnings, createRestateIngress } from "nestjs-restate/ingress/restate-ingress";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Test fixtures ──

@Service("payment")
class PaymentService {
    async charge(req: { amount: number }): Promise<string> {
        return "ref";
    }
}

@VirtualObject("cart")
class CartObject {
    async addItem(item: { name: string }): Promise<void> {}
    async getItems(): Promise<string[]> {
        return [];
    }
}

@Workflow("order")
class OrderWorkflow {
    async run(input: { userId: string }): Promise<string> {
        return "done";
    }
    async confirmShipment(input: { trackingNumber: string }): Promise<void> {}
}

class NotDecorated {}

// ── Mock SDK Ingress ──

function createMockSdkIngress() {
    return {
        serviceClient: vi.fn().mockReturnValue({ charge: vi.fn().mockResolvedValue("pay-123") }),
        objectClient: vi.fn().mockReturnValue({
            addItem: vi.fn(),
            getItems: vi.fn().mockResolvedValue([]),
        }),
        workflowClient: vi.fn().mockReturnValue({
            confirmShipment: vi.fn(),
            workflowSubmit: vi.fn().mockResolvedValue({ invocationId: "inv-1" }),
            workflowAttach: vi.fn().mockResolvedValue("result"),
            workflowOutput: vi.fn().mockResolvedValue({ ready: true, result: "result" }),
        }),
        serviceSendClient: vi.fn().mockReturnValue({ charge: vi.fn() }),
        objectSendClient: vi.fn().mockReturnValue({ addItem: vi.fn() }),
        resolveAwakeable: vi.fn(),
        rejectAwakeable: vi.fn(),
        result: vi.fn(),
    };
}

describe("createRestateIngress", () => {
    let mockSdk: ReturnType<typeof createMockSdkIngress>;
    let ingress: ReturnType<typeof createRestateIngress>;

    beforeEach(() => {
        mockSdk = createMockSdkIngress();
        ingress = createRestateIngress(mockSdk as any);
        clearIngressWarnings();
    });

    describe("class-based serviceClient", () => {
        it("should accept a @Service class and pass { name } to SDK", async () => {
            const client = ingress.serviceClient(PaymentService);
            const result = await client.charge({ amount: 100 });

            expect(mockSdk.serviceClient).toHaveBeenCalledWith({ name: "payment" });
            expect(result).toBe("pay-123");
        });
    });

    describe("class-based objectClient", () => {
        it("should accept a @VirtualObject class + key and pass { name } + key to SDK", () => {
            ingress.objectClient(CartObject, "user-1");

            expect(mockSdk.objectClient).toHaveBeenCalledWith({ name: "cart" }, "user-1");
        });
    });

    describe("class-based workflowClient", () => {
        it("should accept a @Workflow class + key and pass { name } + key to SDK", () => {
            ingress.workflowClient(OrderWorkflow, "order-1");

            expect(mockSdk.workflowClient).toHaveBeenCalledWith({ name: "order" }, "order-1");
        });
    });

    describe("class-based serviceSendClient", () => {
        it("should accept a @Service class for fire-and-forget", () => {
            ingress.serviceSendClient(PaymentService);

            expect(mockSdk.serviceSendClient).toHaveBeenCalledWith({
                name: "payment",
            });
        });
    });

    describe("class-based objectSendClient", () => {
        it("should accept a @VirtualObject class + key for fire-and-forget", () => {
            ingress.objectSendClient(CartObject, "user-1");

            expect(mockSdk.objectSendClient).toHaveBeenCalledWith({ name: "cart" }, "user-1");
        });
    });

    describe("SDK definition passthrough", () => {
        it("should pass plain { name } objects through unchanged", () => {
            const def = { name: "payment" };
            ingress.serviceClient(def as any);

            expect(mockSdk.serviceClient).toHaveBeenCalledWith(def);
        });
    });

    describe("non-intercepted methods passthrough", () => {
        it("should pass resolveAwakeable through to SDK", () => {
            ingress.resolveAwakeable("awk-1", "value");

            expect(mockSdk.resolveAwakeable).toHaveBeenCalledWith("awk-1", "value");
        });

        it("should pass rejectAwakeable through to SDK", () => {
            ingress.rejectAwakeable("awk-1", "reason");

            expect(mockSdk.rejectAwakeable).toHaveBeenCalledWith("awk-1", "reason");
        });
    });

    describe("error handling", () => {
        it("should pass non-decorated class through as-is (SDK handles errors)", () => {
            ingress.serviceClient(NotDecorated as any);

            // NotDecorated is not a Restate component, so it passes through unchanged
            expect(mockSdk.serviceClient).toHaveBeenCalledWith(NotDecorated);
        });
    });

    describe("warnIfInsideHandler", () => {
        it("should log warning when Ingress used inside handler context", () => {
            const warnSpy = vi.spyOn(Logger, "warn").mockImplementation(() => {});

            runWithContext({}, () => {
                ingress.serviceClient(PaymentService);
            });

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("Ingress client used inside a Restate handler"),
                "RestateIngress",
            );

            warnSpy.mockRestore();
        });

        it("should only warn once per target name", () => {
            const warnSpy = vi.spyOn(Logger, "warn").mockImplementation(() => {});

            runWithContext({}, () => {
                ingress.serviceClient(PaymentService);
                ingress.serviceClient(PaymentService);
            });

            expect(warnSpy).toHaveBeenCalledTimes(1);

            warnSpy.mockRestore();
        });

        it("should not warn when outside handler context", () => {
            const warnSpy = vi.spyOn(Logger, "warn").mockImplementation(() => {});

            ingress.serviceClient(PaymentService);

            expect(warnSpy).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });
});
