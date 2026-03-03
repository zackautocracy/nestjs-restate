import type { LoggerContext, LogMetadata } from "@restatedev/restate-sdk";
import { RestateError, RetryableError, TerminalError } from "@restatedev/restate-sdk";
import { createRestateLoggerTransport } from "nestjs-restate/logging/restate-logger.transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createRestateLoggerTransport", () => {
    let transport: ReturnType<typeof createRestateLoggerTransport>;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        transport = createRestateLoggerTransport();
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should suppress logs when replaying", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "info" as any,
            replaying: true,
        };

        transport(params, "should be suppressed");

        expect(stdoutSpy).not.toHaveBeenCalled();
        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should write to stdout for non-error levels", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "info" as any,
            replaying: false,
            context: { invocationTarget: "payment/charge" } as LoggerContext,
        };

        transport(params, "Processing payment");

        expect(stdoutSpy).toHaveBeenCalledTimes(1);
        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("[Nest]");
        expect(output).toContain("LOG");
        expect(output).toContain("[payment/charge]");
        expect(output).toContain("Processing payment");
        expect(output.endsWith("\n")).toBe(true);
    });

    it("should write to stderr for error level", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "error" as any,
            replaying: false,
            context: { invocationTarget: "order/cancel" } as LoggerContext,
        };

        transport(params, "Something failed");

        expect(stderrSpy).toHaveBeenCalledTimes(1);
        const output = stderrSpy.mock.calls[0][0] as string;
        expect(output).toContain("ERROR");
        expect(output).toContain("[order/cancel]");
    });

    it("should use 'Restate' as fallback context when no invocation context", () => {
        const params: LogMetadata = {
            source: "SYSTEM" as any,
            level: "info" as any,
            replaying: false,
        };

        transport(params, "System message");

        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("[Restate]");
    });

    it("should format warn level correctly", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "warn" as any,
            replaying: false,
            context: { invocationTarget: "cart/addItem" } as LoggerContext,
        };

        transport(params, "Low stock");

        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("WARN");
    });

    it("should format debug level correctly", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "debug" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Debug info");

        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("DEBUG");
    });

    it("should format trace level correctly", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "trace" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Trace info");

        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("VERBOSE");
    });

    it("should include additional optional params in output", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "info" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "msg", "extra1", { key: "val" });

        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("msg");
        expect(output).toContain("extra1");
        expect(output).toContain('"key"');
    });

    it("should not throw on circular references", () => {
        const circular: any = { a: 1 };
        circular.self = circular;

        const params: LogMetadata = {
            source: "USER" as any,
            level: "info" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        expect(() => transport(params, "msg", circular)).not.toThrow();

        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("msg");
    });

    it("should not throw on BigInt values", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "info" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        expect(() => transport(params, "count", BigInt(42))).not.toThrow();

        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("42");
    });

    describe("error serialization", () => {
        it("should serialize Error objects with message instead of {}", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new Error("something broke"));

            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("something broke");
            expect(output).not.toContain("{}");
        });

        it("should not include stack traces by default", () => {
            const err = new Error("no stack by default");
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, err);

            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("no stack by default");
            expect(output).not.toContain("    at ");
        });

        it("should include stack traces when stackTraces option is true", () => {
            const transportWithStacks = createRestateLoggerTransport({ stackTraces: true });
            const err = new Error("with stack");
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transportWithStacks(params, err);

            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("with stack");
            expect(output).toContain("    at ");
        });

        it("should handle Error with empty message", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new Error(""));

            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("Unknown error");
        });

        it("should handle Error without stack trace", () => {
            const err = new Error("no stack");
            err.stack = undefined;
            const transportWithStacks = createRestateLoggerTransport({ stackTraces: true });
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transportWithStacks(params, err);

            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("[Error] no stack");
            expect(output).not.toContain("undefined");
        });

        it("should handle undefined values via String() fallback", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "info" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, "msg", undefined);

            const output = stdoutSpy.mock.calls[0][0] as string;
            expect(output).toContain("msg");
            expect(output).toContain("undefined");
        });
    });

    describe("error classification labels", () => {
        it("should label TerminalError", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new TerminalError("permanent failure"));

            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("[TerminalError]");
            expect(output).toContain("permanent failure");
        });

        it("should label RetryableError", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "warn" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new RetryableError("transient issue"));

            const output = stdoutSpy.mock.calls[0][0] as string;
            expect(output).toContain("[RetryableError]");
            expect(output).toContain("transient issue");
        });

        it("should label RestateError", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new RestateError("restate issue"));

            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("[RestateError]");
            expect(output).toContain("restate issue");
        });

        it("should label plain Error", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new Error("generic error"));

            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("[Error]");
            expect(output).toContain("generic error");
        });
    });

    describe("timestamp format", () => {
        it("should use Intl.DateTimeFormat for NestJS-aligned timestamps", () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2025-06-15T14:30:00.000Z"));

            const t = createRestateLoggerTransport();
            const params: LogMetadata = {
                source: "USER" as any,
                level: "info" as any,
                replaying: false,
            };

            t(params, "test");

            const output = stdoutSpy.mock.calls[0][0] as string;
            // Verify format matches Intl.DateTimeFormat output (locale-dependent but consistent)
            const expected = new Intl.DateTimeFormat(undefined, {
                year: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
                day: "2-digit",
                month: "2-digit",
            }).format(new Date("2025-06-15T14:30:00.000Z"));
            expect(output).toContain(expected);

            vi.useRealTimers();
        });
    });

    describe("log level mapping", () => {
        it("should escalate TerminalError from WARN to ERROR", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "warn" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new TerminalError("fatal"));

            expect(stderrSpy).toHaveBeenCalledTimes(1);
            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("ERROR");
        });

        it("should downgrade RetryableError from WARN to DEBUG", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "warn" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new RetryableError("will retry"));

            expect(stdoutSpy).toHaveBeenCalledTimes(1);
            const output = stdoutSpy.mock.calls[0][0] as string;
            expect(output).toContain("DEBUG");
        });

        it("should downgrade plain Error from WARN to DEBUG", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "warn" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new Error("temporary"));

            expect(stdoutSpy).toHaveBeenCalledTimes(1);
            const output = stdoutSpy.mock.calls[0][0] as string;
            expect(output).toContain("DEBUG");
        });

        it("should downgrade 'Invocation suspended' from INFO to DEBUG", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "info" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, "Invocation suspended");

            const output = stdoutSpy.mock.calls[0][0] as string;
            expect(output).toContain("DEBUG");
            expect(output).not.toContain("LOG");
        });

        it("should not change non-error WARN messages", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "warn" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, "Low stock warning");

            const output = stdoutSpy.mock.calls[0][0] as string;
            expect(output).toContain("WARN");
        });

        it("should not downgrade RetryableError already at ERROR", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "error" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, new RetryableError("at error level"));

            expect(stderrSpy).toHaveBeenCalledTimes(1);
            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("ERROR");
        });

        it("should escalate TerminalError in optionalParams", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "warn" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, "Error occurred", new TerminalError("fatal"));

            expect(stderrSpy).toHaveBeenCalledTimes(1);
            const output = stderrSpy.mock.calls[0][0] as string;
            expect(output).toContain("ERROR");
        });

        it("should fall back to LOG for unknown log levels", () => {
            const params: LogMetadata = {
                source: "USER" as any,
                level: "unknown" as any,
                replaying: false,
                context: { invocationTarget: "svc/handler" } as LoggerContext,
            };

            transport(params, "mystery level");

            const output = stdoutSpy.mock.calls[0][0] as string;
            expect(output).toContain("LOG");
        });
    });
});
