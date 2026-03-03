import "reflect-metadata";
import {
    objectDefinitionOf,
    Service,
    serviceDefinitionOf,
    VirtualObject,
    Workflow,
    workflowDefinitionOf,
} from "nestjs-restate";
import { describe, expect, it } from "vitest";

@Service("payment")
class PaymentService {
    async charge(req: { amount: number }): Promise<string> {
        return "ref";
    }
}

@VirtualObject("cart")
class CartObject {
    async addItem(item: { name: string }): Promise<void> {}
}

@Workflow("order")
class OrderWorkflow {
    async run(input: { userId: string }): Promise<string> {
        return "done";
    }
}

class NotDecorated {}

describe("definitionOf utilities", () => {
    describe("serviceDefinitionOf", () => {
        it("should return { name } from @Service metadata", () => {
            const def = serviceDefinitionOf(PaymentService);
            expect(def).toEqual({ name: "payment" });
        });

        it("should throw for non-decorated class", () => {
            expect(() => serviceDefinitionOf(NotDecorated as any)).toThrow(
                /has no Restate component decorator/,
            );
        });
    });

    describe("objectDefinitionOf", () => {
        it("should return { name } from @VirtualObject metadata", () => {
            const def = objectDefinitionOf(CartObject);
            expect(def).toEqual({ name: "cart" });
        });
    });

    describe("workflowDefinitionOf", () => {
        it("should return { name } from @Workflow metadata", () => {
            const def = workflowDefinitionOf(OrderWorkflow);
            expect(def).toEqual({ name: "order" });
        });
    });

    describe("type mismatch validation", () => {
        it("serviceDefinitionOf rejects @VirtualObject class", () => {
            expect(() => serviceDefinitionOf(CartObject as any)).toThrow(
                /serviceDefinitionOf\(\) expects a @Service\(\) class, but 'cart' is an object component/,
            );
        });

        it("serviceDefinitionOf rejects @Workflow class", () => {
            expect(() => serviceDefinitionOf(OrderWorkflow as any)).toThrow(
                /serviceDefinitionOf\(\) expects a @Service\(\) class, but 'order' is a workflow component/,
            );
        });

        it("objectDefinitionOf rejects @Service class", () => {
            expect(() => objectDefinitionOf(PaymentService as any)).toThrow(
                /objectDefinitionOf\(\) expects a @VirtualObject\(\) class, but 'payment' is a service component/,
            );
        });

        it("workflowDefinitionOf rejects @Service class", () => {
            expect(() => workflowDefinitionOf(PaymentService as any)).toThrow(
                /workflowDefinitionOf\(\) expects a @Workflow\(\) class, but 'payment' is a service component/,
            );
        });
    });
});
