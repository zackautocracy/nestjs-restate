import {
    createDefaultRestateCallbackMetadata,
    RestateParamsFactory,
    RestateParamtype,
} from "nestjs-restate/pipeline/restate-params-factory";

describe("RestateParamtype", () => {
    it("should have INPUT = 0", () => {
        expect(RestateParamtype.INPUT).toBe(0);
    });

    it("should have CONTEXT = 1", () => {
        expect(RestateParamtype.CONTEXT).toBe(1);
    });
});

describe("RestateParamsFactory", () => {
    let factory: RestateParamsFactory;

    beforeEach(() => {
        factory = new RestateParamsFactory();
    });

    describe("exchangeKeyForValue", () => {
        it("should return args[1] for CONTEXT param type", () => {
            const ctx = { serviceName: "test" };
            const args = [{ orderId: "123" }, ctx];

            const result = factory.exchangeKeyForValue(RestateParamtype.CONTEXT, undefined, args);

            expect(result).toBe(ctx);
        });

        it("should return args[0] for INPUT param type when no data key", () => {
            const input = { orderId: "123", amount: 42 };
            const args = [input, { serviceName: "test" }];

            const result = factory.exchangeKeyForValue(RestateParamtype.INPUT, undefined, args);

            expect(result).toBe(input);
        });

        it("should return args[0][data] for INPUT param type with data key", () => {
            const input = { orderId: "123", amount: 42 };
            const args = [input, { serviceName: "test" }];

            const result = factory.exchangeKeyForValue(RestateParamtype.INPUT, "orderId", args);

            expect(result).toBe("123");
        });

        it("should return undefined for INPUT with data key when args[0] is undefined", () => {
            const args = [undefined, { serviceName: "test" }];

            const result = factory.exchangeKeyForValue(RestateParamtype.INPUT, "orderId", args);

            expect(result).toBeUndefined();
        });

        it("should return null for INPUT with data key when args[0] is null", () => {
            const args = [null, { serviceName: "test" }];

            const result = factory.exchangeKeyForValue(RestateParamtype.INPUT, "orderId", args);

            expect(result).toBeNull();
        });

        it("should return null for unknown param types", () => {
            const args = [{ orderId: "123" }, { serviceName: "test" }];

            const result = factory.exchangeKeyForValue(99, undefined, args);

            expect(result).toBeNull();
        });

        it("should return null when args is null", () => {
            const result = factory.exchangeKeyForValue(RestateParamtype.CONTEXT, undefined, null);

            expect(result).toBeNull();
        });

        it("should return null when args is undefined", () => {
            const result = factory.exchangeKeyForValue(
                RestateParamtype.CONTEXT,
                undefined,
                undefined,
            );

            expect(result).toBeNull();
        });
    });
});

describe("createDefaultRestateCallbackMetadata", () => {
    it("should return correct shape", () => {
        expect(createDefaultRestateCallbackMetadata()).toEqual({
            "0:0": { index: 0, data: undefined, pipes: [] },
        });
    });

    it("should return a fresh object each call", () => {
        const a = createDefaultRestateCallbackMetadata();
        const b = createDefaultRestateCallbackMetadata();
        expect(a).not.toBe(b);
        expect(a["0:0"].pipes).not.toBe(b["0:0"].pipes);
    });
});
