import "reflect-metadata";
import { ConsoleLogger } from "@nestjs/common";
import * as contextStore from "nestjs-restate/context/restate-context.store";
import { RestateLoggerService } from "nestjs-restate/logging/restate-logger.service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("RestateLoggerService", () => {
    let service: RestateLoggerService;
    let getContextIfAvailableSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        service = new RestateLoggerService();
        getContextIfAvailableSpy = vi.spyOn(contextStore, "getContextIfAvailable");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("outside handler context", () => {
        beforeEach(() => {
            getContextIfAvailableSpy.mockReturnValue(undefined);
        });

        it("should delegate log() to ConsoleLogger.log()", () => {
            const spy = vi.spyOn(ConsoleLogger.prototype, "log").mockImplementation(() => {});
            service.log("hello", "TestCtx");
            expect(spy).toHaveBeenCalledWith("hello", "TestCtx");
        });

        it("should delegate error() to ConsoleLogger.error()", () => {
            const spy = vi.spyOn(ConsoleLogger.prototype, "error").mockImplementation(() => {});
            service.error("fail", "stack-trace");
            expect(spy).toHaveBeenCalledWith("fail", "stack-trace");
        });

        it("should delegate warn() to ConsoleLogger.warn()", () => {
            const spy = vi.spyOn(ConsoleLogger.prototype, "warn").mockImplementation(() => {});
            service.warn("caution");
            expect(spy).toHaveBeenCalledWith("caution");
        });

        it("should delegate debug() to ConsoleLogger.debug()", () => {
            const spy = vi.spyOn(ConsoleLogger.prototype, "debug").mockImplementation(() => {});
            service.debug("detail", "Ctx");
            expect(spy).toHaveBeenCalledWith("detail", "Ctx");
        });

        it("should delegate verbose() to ConsoleLogger.verbose()", () => {
            const spy = vi.spyOn(ConsoleLogger.prototype, "verbose").mockImplementation(() => {});
            service.verbose("trace-info");
            expect(spy).toHaveBeenCalledWith("trace-info");
        });

        it("should delegate fatal() to ConsoleLogger.fatal()", () => {
            const spy = vi.spyOn(ConsoleLogger.prototype, "fatal").mockImplementation(() => {});
            service.fatal("critical");
            expect(spy).toHaveBeenCalledWith("critical");
        });
    });

    describe("inside handler context", () => {
        let mockConsole: Record<string, ReturnType<typeof vi.fn>>;

        beforeEach(() => {
            mockConsole = {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn(),
                trace: vi.fn(),
            };
            getContextIfAvailableSpy.mockReturnValue({ console: mockConsole });
        });

        it("should delegate log() to ctx.console.info()", () => {
            service.log("hello", "TestCtx");
            expect(mockConsole.info).toHaveBeenCalledWith("hello", "TestCtx");
        });

        it("should delegate error() to ctx.console.error()", () => {
            service.error("fail", "stack-trace");
            expect(mockConsole.error).toHaveBeenCalledWith("fail", "stack-trace");
        });

        it("should delegate warn() to ctx.console.warn()", () => {
            service.warn("caution");
            expect(mockConsole.warn).toHaveBeenCalledWith("caution");
        });

        it("should delegate debug() to ctx.console.debug()", () => {
            service.debug("detail", "Ctx");
            expect(mockConsole.debug).toHaveBeenCalledWith("detail", "Ctx");
        });

        it("should delegate verbose() to ctx.console.trace()", () => {
            service.verbose("trace-info");
            expect(mockConsole.trace).toHaveBeenCalledWith("trace-info");
        });

        it("should delegate fatal() to ctx.console.error()", () => {
            service.fatal("critical");
            expect(mockConsole.error).toHaveBeenCalledWith("critical");
        });
    });
});
