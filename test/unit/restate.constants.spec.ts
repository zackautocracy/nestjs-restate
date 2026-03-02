import {
    HANDLER_METADATA_KEY,
    RESTATE_CLIENT,
    RESTATE_ENDPOINT,
    RESTATE_OPTIONS,
    SERVICE_METADATA_KEY,
    VIRTUAL_OBJECT_METADATA_KEY,
    WORKFLOW_METADATA_KEY,
} from "../../src/restate.constants";

describe("Restate Constants", () => {
    it("should export unique Symbol tokens", () => {
        expect(typeof RESTATE_CLIENT).toBe("symbol");
        expect(typeof RESTATE_OPTIONS).toBe("symbol");
        expect(typeof RESTATE_ENDPOINT).toBe("symbol");
        expect(RESTATE_CLIENT).not.toBe(RESTATE_OPTIONS);
        expect(RESTATE_CLIENT).not.toBe(RESTATE_ENDPOINT);
    });

    it("should export metadata keys as symbols", () => {
        expect(typeof WORKFLOW_METADATA_KEY).toBe("symbol");
        expect(typeof SERVICE_METADATA_KEY).toBe("symbol");
        expect(typeof VIRTUAL_OBJECT_METADATA_KEY).toBe("symbol");
        expect(typeof HANDLER_METADATA_KEY).toBe("symbol");
    });

    it("should have all symbols be unique", () => {
        const allSymbols = [
            RESTATE_CLIENT,
            RESTATE_OPTIONS,
            RESTATE_ENDPOINT,
            WORKFLOW_METADATA_KEY,
            SERVICE_METADATA_KEY,
            VIRTUAL_OBJECT_METADATA_KEY,
            HANDLER_METADATA_KEY,
        ];
        const unique = new Set(allSymbols);
        expect(unique.size).toBe(allSymbols.length);
    });
});
