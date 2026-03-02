import "reflect-metadata";
import { getClientToken } from "nestjs-restate/proxy/client-token";
import { describe, expect, it } from "vitest";

describe("getClientToken", () => {
    it("should return a symbol", () => {
        class Foo {}
        const token = getClientToken(Foo);
        expect(typeof token).toBe("symbol");
    });

    it("should return the same symbol for the same class", () => {
        class Bar {}
        const token1 = getClientToken(Bar);
        const token2 = getClientToken(Bar);
        expect(token1).toBe(token2);
    });

    it("should return different symbols for different classes", () => {
        class A {}
        class B {}
        expect(getClientToken(A)).not.toBe(getClientToken(B));
    });

    it("should include the class name in the symbol description", () => {
        class MyService {}
        const token = getClientToken(MyService);
        expect(token.description).toContain("MyService");
    });
});
