import "reflect-metadata";
import {
    clearComponentRegistry,
    getRegisteredComponents,
    registerComponent,
} from "nestjs-restate/registry/component-registry";

describe("component-registry", () => {
    beforeEach(() => {
        clearComponentRegistry();
    });

    it("should register a component", () => {
        class MyService {}
        registerComponent(MyService);
        expect(getRegisteredComponents().has(MyService)).toBe(true);
    });

    it("should not duplicate registrations", () => {
        class MyService {}
        registerComponent(MyService);
        registerComponent(MyService);
        expect(getRegisteredComponents().size).toBe(1);
    });

    it("should clear all registrations", () => {
        class A {}
        class B {}
        registerComponent(A);
        registerComponent(B);
        expect(getRegisteredComponents().size).toBe(2);

        clearComponentRegistry();
        expect(getRegisteredComponents().size).toBe(0);
    });

    it("should register multiple components", () => {
        class A {}
        class B {}
        class C {}
        registerComponent(A);
        registerComponent(B);
        registerComponent(C);
        expect(getRegisteredComponents().size).toBe(3);
    });
});
