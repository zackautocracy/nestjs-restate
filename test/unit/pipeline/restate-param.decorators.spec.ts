import "reflect-metadata";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { Ctx, Input } from "nestjs-restate/pipeline/restate-param.decorators";

function getFactory(target: any, methodName: string) {
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, target, methodName);
    const key = Object.keys(metadata).find((k) => k.includes("__customRouteArgs__")) as string;
    return metadata[key].factory;
}

function createMockContext(input: any, restateCtx: any) {
    const ctx = new ExecutionContextHost([input, restateCtx]);
    ctx.setType("restate");
    return ctx;
}

describe("@Input()", () => {
    it("should set metadata under ROUTE_ARGS_METADATA", () => {
        class TestHandler {
            handle(@Input() input: any) {
                return input;
            }
        }

        const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestHandler, "handle");
        expect(metadata).toBeDefined();

        const keys = Object.keys(metadata);
        expect(keys).toHaveLength(1);
        expect(metadata[keys[0]]).toMatchObject({ index: 0 });
    });

    it("should store data key for property extraction", () => {
        class TestHandler {
            handle(@Input("amount") amount: number) {
                return amount;
            }
        }

        const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestHandler, "handle");
        const keys = Object.keys(metadata);
        expect(metadata[keys[0]]).toMatchObject({ index: 0, data: "amount" });
    });

    it("should support multiple decorated params", () => {
        class TestHandler {
            handle(@Input("amount") amount: number, @Input("currency") currency: string) {
                return { amount, currency };
            }
        }

        const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestHandler, "handle");
        const keys = Object.keys(metadata);
        expect(keys).toHaveLength(2);
    });

    describe("factory function", () => {
        it("should return the full input when no data key", () => {
            class T {
                handle(@Input() input: any) {
                    return input;
                }
            }
            const factory = getFactory(T, "handle");
            const input = { amount: 42, currency: "USD" };
            const ctx = createMockContext(input, {});

            expect(factory(undefined, ctx)).toBe(input);
        });

        it("should extract a property when data key is provided", () => {
            class T {
                handle(@Input("amount") amount: number) {
                    return amount;
                }
            }
            const factory = getFactory(T, "handle");
            const ctx = createMockContext({ amount: 42, currency: "USD" }, {});

            expect(factory("amount", ctx)).toBe(42);
        });

        it("should return undefined for missing property", () => {
            class T {
                handle(@Input("missing") val: any) {
                    return val;
                }
            }
            const factory = getFactory(T, "handle");
            const ctx = createMockContext({ amount: 42 }, {});

            expect(factory("missing", ctx)).toBeUndefined();
        });

        it("should handle undefined input gracefully", () => {
            class T {
                handle(@Input("amount") amount: any) {
                    return amount;
                }
            }
            const factory = getFactory(T, "handle");
            const ctx = createMockContext(undefined, {});

            expect(factory("amount", ctx)).toBeUndefined();
        });
    });
});

describe("@Ctx()", () => {
    it("should set metadata under ROUTE_ARGS_METADATA", () => {
        class TestHandler {
            handle(@Ctx() ctx: any) {
                return ctx;
            }
        }

        const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestHandler, "handle");
        expect(metadata).toBeDefined();

        const keys = Object.keys(metadata);
        expect(keys).toHaveLength(1);
        expect(metadata[keys[0]]).toMatchObject({ index: 0 });
    });

    it("should return the Restate SDK context via factory", () => {
        class T {
            handle(@Ctx() ctx: any) {
                return ctx;
            }
        }
        const factory = getFactory(T, "handle");
        const restateCtx = { serviceName: "test" };
        const ctx = createMockContext({ amount: 42 }, restateCtx);

        expect(factory(undefined, ctx)).toBe(restateCtx);
    });
});

describe("@Input() + @Ctx() combined", () => {
    it("should store metadata for both params", () => {
        class TestHandler {
            handle(@Input() input: any, @Ctx() ctx: any) {
                return { input, ctx };
            }
        }

        const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestHandler, "handle");
        const keys = Object.keys(metadata);
        expect(keys).toHaveLength(2);

        const entries = Object.values(metadata) as any[];
        const indices = entries.map((e) => e.index).sort();
        expect(indices).toEqual([0, 1]);
    });
});
