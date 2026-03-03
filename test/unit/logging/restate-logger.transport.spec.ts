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

    it("should serialize Error objects with message and stack", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "error" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };
        const error = new Error("something broke");

        transport(params, "Operation failed", error);

        const output = stderrSpy.mock.calls[0][0] as string;
        expect(output).toContain("something broke");
        expect(output).toContain("[Error]");
        expect(output).not.toContain("{}");
    });

    it("should not produce '{}' for Error objects", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "error" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Failed", new Error("test error"));

        const output = stderrSpy.mock.calls[0][0] as string;
        // The old bug: JSON.stringify(new Error()) produces "{}"
        // Verify the serialized error is NOT just "{}"
        expect(output).not.toMatch(/\s\{\}\s*$/);
        expect(output).toContain("test error");
    });

    it("should label TerminalError with [TerminalError]", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "error" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Failed", new TerminalError("permanent failure"));

        const output = stderrSpy.mock.calls[0][0] as string;
        expect(output).toContain("[TerminalError]");
        expect(output).toContain("permanent failure");
    });

    it("should label RetryableError with [RetryableError]", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "warn" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Retrying", new RetryableError("transient issue"));

        const output =
            (stdoutSpy.mock.calls[0]?.[0] as string) ?? (stderrSpy.mock.calls[0]?.[0] as string);
        expect(output).toContain("[RetryableError]");
        expect(output).toContain("transient issue");
    });

    it("should format timestamp using Intl.DateTimeFormat matching NestJS", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "info" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "test");

        const output = stdoutSpy.mock.calls[0][0] as string;
        // NestJS uses: new Intl.DateTimeFormat(undefined, { year, month, day, hour, minute, second })
        const expectedTimestamp = new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            day: "2-digit",
            month: "2-digit",
        }).format(Date.now());
        expect(output).toContain(expectedTimestamp);
    });

    it("should label RestateError with [RestateError]", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "error" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Restate error", new RestateError("internal"));

        const output = stderrSpy.mock.calls[0][0] as string;
        expect(output).toContain("[RestateError]");
        expect(output).toContain("internal");
    });

    it("should escalate TerminalError from WARN to ERROR (stderr)", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "warn" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Error when processing ctx.run 'charge'.", new TerminalError("bad card"));

        expect(stderrSpy).toHaveBeenCalledTimes(1);
        expect(stdoutSpy).not.toHaveBeenCalled();
        const output = stderrSpy.mock.calls[0][0] as string;
        expect(output).toContain("ERROR");
        expect(output).not.toContain("WARN");
    });

    it("should downgrade retryable error from WARN to DEBUG (stdout)", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "warn" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Error when processing ctx.run 'upload'.", new RetryableError("timeout"));

        expect(stdoutSpy).toHaveBeenCalledTimes(1);
        expect(stderrSpy).not.toHaveBeenCalled();
        const output = stdoutSpy.mock.calls[0][0] as string;
        expect(output).toContain("DEBUG");
        expect(output).not.toContain("WARN");
    });

    it("should downgrade plain Error at WARN to DEBUG", () => {
        const params: LogMetadata = {
            source: "USER" as any,
            level: "warn" as any,
            replaying: false,
            context: { invocationTarget: "svc/handler" } as LoggerContext,
        };

        transport(params, "Error when processing", new Error("some error"));

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

    it("should pass through non-error WARN logs unchanged", () => {
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
});
