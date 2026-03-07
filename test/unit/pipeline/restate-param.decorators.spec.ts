import "reflect-metadata";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { Ctx, Input } from "nestjs-restate/pipeline/restate-param.decorators";

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
