import "reflect-metadata";
import { Service, VirtualObject, Workflow } from "nestjs-restate";
import { getComponentMeta, isRestateComponent } from "nestjs-restate/registry/component-metadata";
import { describe, expect, it } from "vitest";

// ── Test fixtures ──

@Service("payment")
class PaymentService {
    async charge(): Promise<string> {
        return "ok";
    }
}

@VirtualObject("cart")
class CartObject {
    async addItem(): Promise<void> {}
}

@Workflow("signup")
class SignupWorkflow {
    async run(): Promise<string> {
        return "done";
    }
}

class NotDecorated {
    async doSomething(): Promise<void> {}
}

describe("component-metadata", () => {
    describe("isRestateComponent", () => {
        it("should return true for @Service class", () => {
            expect(isRestateComponent(PaymentService)).toBe(true);
        });

        it("should return true for @VirtualObject class", () => {
            expect(isRestateComponent(CartObject)).toBe(true);
        });

        it("should return true for @Workflow class", () => {
            expect(isRestateComponent(SignupWorkflow)).toBe(true);
        });

        it("should return false for undecorated class", () => {
            expect(isRestateComponent(NotDecorated)).toBe(false);
        });

        it("should return false for a string", () => {
            expect(isRestateComponent("hello")).toBe(false);
        });

        it("should return false for a number", () => {
            expect(isRestateComponent(42)).toBe(false);
        });

        it("should return false for null", () => {
            expect(isRestateComponent(null)).toBe(false);
        });

        it("should return false for undefined", () => {
            expect(isRestateComponent(undefined)).toBe(false);
        });

        it("should return false for a plain object", () => {
            expect(isRestateComponent({ name: "payment" })).toBe(false);
        });
    });

    describe("getComponentMeta", () => {
        it("should return service type and name for @Service class", () => {
            expect(getComponentMeta(PaymentService)).toEqual({
                type: "service",
                name: "payment",
            });
        });

        it("should return object type and name for @VirtualObject class", () => {
            expect(getComponentMeta(CartObject)).toEqual({
                type: "object",
                name: "cart",
            });
        });

        it("should return workflow type and name for @Workflow class", () => {
            expect(getComponentMeta(SignupWorkflow)).toEqual({
                type: "workflow",
                name: "signup",
            });
        });

        it("should throw for undecorated class", () => {
            expect(() => getComponentMeta(NotDecorated)).toThrow(
                /has no Restate component decorator/,
            );
        });

        it("should throw for null", () => {
            expect(() => getComponentMeta(null)).toThrow(
                /Expected a class constructor, but received null/,
            );
        });

        it("should throw for undefined", () => {
            expect(() => getComponentMeta(undefined)).toThrow(
                /Expected a class constructor, but received undefined/,
            );
        });

        it("should throw for a plain object", () => {
            expect(() => getComponentMeta({ name: "foo" })).toThrow(
                /Expected a class constructor, but received object/,
            );
        });

        it("should throw for a string", () => {
            expect(() => getComponentMeta("hello")).toThrow(
                /Expected a class constructor, but received string/,
            );
        });
    });
});
