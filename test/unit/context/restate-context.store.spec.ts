import { getCurrentContext, runWithContext } from "nestjs-restate/context/restate-context.store";
import { describe, expect, it } from "vitest";

describe("restate-context.store", () => {
    describe("runWithContext", () => {
        it("should make context available inside the callback", () => {
            const mockCtx = { key: "test-key" };
            let captured: any;

            runWithContext(mockCtx, () => {
                captured = getCurrentContext();
            });

            expect(captured).toBe(mockCtx);
        });

        it("should return the callback's return value", () => {
            const result = runWithContext({}, () => 42);
            expect(result).toBe(42);
        });

        it("should support async callbacks", async () => {
            const mockCtx = { key: "async-key" };

            const result = await runWithContext(mockCtx, async () => {
                await new Promise((resolve) => setTimeout(resolve, 1));
                return getCurrentContext();
            });

            expect(result).toBe(mockCtx);
        });

        it("should isolate contexts in concurrent calls", async () => {
            const ctx1 = { id: "ctx-1" };
            const ctx2 = { id: "ctx-2" };

            const [result1, result2] = await Promise.all([
                runWithContext(ctx1, async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    return getCurrentContext();
                }),
                runWithContext(ctx2, async () => {
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    return getCurrentContext();
                }),
            ]);

            expect(result1).toBe(ctx1);
            expect(result2).toBe(ctx2);
        });
    });

    describe("getCurrentContext", () => {
        it("should throw when called outside runWithContext", () => {
            expect(() => getCurrentContext()).toThrow("Restate context not available");
        });

        it("should throw with a helpful error message mentioning @InjectClient()", () => {
            expect(() => getCurrentContext()).toThrow("@InjectClient()");
        });

        it("should return the context with correct type when generic is specified", () => {
            const mockCtx = { key: "typed", run: vi.fn() };

            runWithContext(mockCtx, () => {
                const ctx = getCurrentContext<{ key: string; run: () => void }>();
                expect(ctx.key).toBe("typed");
                expect(typeof ctx.run).toBe("function");
            });
        });
    });
});
