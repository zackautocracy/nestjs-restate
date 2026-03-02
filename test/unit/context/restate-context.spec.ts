import "reflect-metadata";
import { RestateContext } from "nestjs-restate/context/restate-context";
import { runWithContext } from "nestjs-restate/context/restate-context.store";
import { describe, expect, it, vi } from "vitest";

describe("RestateContext", () => {
    const ctx = new RestateContext();

    describe("outside handler context", () => {
        it("should throw when accessing any method outside a handler", () => {
            expect(() => ctx.raw).toThrow("Restate context not available");
        });
    });

    describe("durable execution", () => {
        it("should delegate run() to SDK context", async () => {
            const mockRun = vi.fn().mockResolvedValue("result");
            const mockCtx = { run: mockRun };

            const result = await runWithContext(mockCtx, () =>
                ctx.run("step-name", () => "result"),
            );

            expect(mockRun).toHaveBeenCalledWith("step-name", expect.any(Function));
            expect(result).toBe("result");
        });

        it("should delegate run() with action only (nameless)", async () => {
            const mockRun = vi.fn().mockResolvedValue("result");
            const mockCtx = { run: mockRun };

            const result = await runWithContext(mockCtx, () => ctx.run(() => "result"));

            expect(mockRun).toHaveBeenCalledWith(expect.any(Function));
            expect(result).toBe("result");
        });

        it("should delegate run() with name, action, and options", async () => {
            const mockRun = vi.fn().mockResolvedValue("result");
            const mockCtx = { run: mockRun };
            const options = { maxRetryAttempts: 3 };

            const result = await runWithContext(mockCtx, () =>
                ctx.run("step", () => "result", options),
            );

            expect(mockRun).toHaveBeenCalledWith("step", expect.any(Function), options);
            expect(result).toBe("result");
        });

        it("should delegate sleep() to SDK context", async () => {
            const mockSleep = vi.fn().mockResolvedValue(undefined);
            const mockCtx = { sleep: mockSleep };

            await runWithContext(mockCtx, () => ctx.sleep(1000));

            expect(mockSleep).toHaveBeenCalledWith(1000);
        });
    });

    describe("awakeables", () => {
        it("should delegate awakeable() to SDK context", () => {
            const mockResult = { id: "awk-1", promise: Promise.resolve("val") };
            const mockCtx = { awakeable: vi.fn().mockReturnValue(mockResult) };

            const result = runWithContext(mockCtx, () => ctx.awakeable());

            expect(result).toBe(mockResult);
        });

        it("should delegate resolveAwakeable() to SDK context", () => {
            const mockCtx = { resolveAwakeable: vi.fn() };

            runWithContext(mockCtx, () => ctx.resolveAwakeable("awk-1", "value"));

            expect(mockCtx.resolveAwakeable).toHaveBeenCalledWith("awk-1", "value");
        });

        it("should delegate rejectAwakeable() to SDK context", () => {
            const mockCtx = { rejectAwakeable: vi.fn() };

            runWithContext(mockCtx, () => ctx.rejectAwakeable("awk-1", "reason"));

            expect(mockCtx.rejectAwakeable).toHaveBeenCalledWith("awk-1", "reason");
        });
    });

    describe("random", () => {
        it("should delegate rand to SDK context", () => {
            const mockRand = { uuidv4: () => "uuid", random: () => 0.5 };
            const mockCtx = { rand: mockRand };

            const result = runWithContext(mockCtx, () => ctx.rand);

            expect(result).toBe(mockRand);
        });
    });

    describe("state operations", () => {
        it("should delegate get() to SDK context", async () => {
            const mockCtx = { get: vi.fn().mockResolvedValue(42) };

            const result = await runWithContext(mockCtx, () => ctx.get("count"));

            expect(mockCtx.get).toHaveBeenCalledWith("count");
            expect(result).toBe(42);
        });

        it("should delegate set() to SDK context", () => {
            const mockCtx = { set: vi.fn() };

            runWithContext(mockCtx, () => ctx.set("count", 42));

            expect(mockCtx.set).toHaveBeenCalledWith("count", 42);
        });

        it("should delegate clear() to SDK context", () => {
            const mockCtx = { clear: vi.fn() };

            runWithContext(mockCtx, () => ctx.clear("count"));

            expect(mockCtx.clear).toHaveBeenCalledWith("count");
        });

        it("should delegate clearAll() to SDK context", () => {
            const mockCtx = { clearAll: vi.fn() };

            runWithContext(mockCtx, () => ctx.clearAll());

            expect(mockCtx.clearAll).toHaveBeenCalled();
        });

        it("should delegate stateKeys() to SDK context", async () => {
            const mockCtx = { stateKeys: vi.fn().mockResolvedValue(["a", "b"]) };

            const result = await runWithContext(mockCtx, () => ctx.stateKeys());

            expect(result).toEqual(["a", "b"]);
        });
    });

    describe("workflow promises", () => {
        it("should delegate promise() to SDK context", () => {
            const mockPromise = { peek: vi.fn(), resolve: vi.fn(), reject: vi.fn() };
            const mockCtx = { promise: vi.fn().mockReturnValue(mockPromise) };

            const result = runWithContext(mockCtx, () => ctx.promise("payment-done"));

            expect(mockCtx.promise).toHaveBeenCalledWith("payment-done");
            expect(result).toBe(mockPromise);
        });
    });

    describe("object key", () => {
        it("should delegate key to SDK context", () => {
            const mockCtx = { key: "user-123" };

            const result = runWithContext(mockCtx, () => ctx.key);

            expect(result).toBe("user-123");
        });
    });

    describe("raw escape hatch", () => {
        it("should return the raw SDK context", () => {
            const mockCtx = { run: vi.fn(), key: "test" };

            const result = runWithContext(mockCtx, () => ctx.raw);

            expect(result).toBe(mockCtx);
        });
    });

    describe("date", () => {
        it("should delegate date to SDK context", () => {
            const mockDate = { now: vi.fn(), toJSON: vi.fn() };
            const mockCtx = { date: mockDate };

            const result = runWithContext(mockCtx, () => ctx.date);

            expect(result).toBe(mockDate);
        });
    });

    describe("invocation management", () => {
        it("should delegate request() to SDK context", () => {
            const mockRequest = { id: "inv-1", headers: new Map() };
            const mockCtx = {
                request: vi.fn().mockReturnValue(mockRequest),
            };

            const result = runWithContext(mockCtx, () => ctx.request());

            expect(result).toBe(mockRequest);
        });

        it("should delegate cancel() to SDK context", () => {
            const mockCtx = { cancel: vi.fn() };

            runWithContext(mockCtx, () => ctx.cancel("inv-123" as any));

            expect(mockCtx.cancel).toHaveBeenCalledWith("inv-123");
        });

        it("should delegate attach() to SDK context", async () => {
            const mockCtx = {
                attach: vi.fn().mockResolvedValue("result"),
            };

            const result = await runWithContext(mockCtx, () => ctx.attach("inv-123" as any));

            expect(mockCtx.attach).toHaveBeenCalledWith("inv-123");
            expect(result).toBe("result");
        });

        it("should delegate attach() with serde to SDK context", async () => {
            const mockSerde = {} as any;
            const mockCtx = {
                attach: vi.fn().mockResolvedValue("result"),
            };

            const result = await runWithContext(mockCtx, () =>
                ctx.attach("inv-123" as any, mockSerde),
            );

            expect(mockCtx.attach).toHaveBeenCalledWith("inv-123", mockSerde);
            expect(result).toBe("result");
        });
    });

    describe("generic calls", () => {
        it("should delegate genericCall() to SDK context", async () => {
            const mockCtx = {
                genericCall: vi.fn().mockResolvedValue("result"),
            };
            const call = { service: "svc", method: "m", parameter: {} };

            const result = await runWithContext(mockCtx, () => ctx.genericCall(call as any));

            expect(mockCtx.genericCall).toHaveBeenCalledWith(call);
            expect(result).toBe("result");
        });

        it("should delegate genericSend() to SDK context", () => {
            const mockHandle = {
                invocationId: Promise.resolve("id"),
            };
            const mockCtx = {
                genericSend: vi.fn().mockReturnValue(mockHandle),
            };
            const send = { service: "svc", method: "m", parameter: {} };

            const result = runWithContext(mockCtx, () => ctx.genericSend(send as any));

            expect(mockCtx.genericSend).toHaveBeenCalledWith(send);
            expect(result).toBe(mockHandle);
        });
    });

    describe("singleton safety", () => {
        it("should use different contexts for concurrent invocations", async () => {
            const ctx1 = { key: "user-1" };
            const ctx2 = { key: "user-2" };

            const [key1, key2] = await Promise.all([
                runWithContext(ctx1, async () => {
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    return ctx.key;
                }),
                runWithContext(ctx2, async () => {
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    return ctx.key;
                }),
            ]);

            expect(key1).toBe("user-1");
            expect(key2).toBe("user-2");
        });
    });
});
