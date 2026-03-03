import type { LoggerTransport, LogMetadata } from "@restatedev/restate-sdk";
import { RestateError, RetryableError, TerminalError } from "@restatedev/restate-sdk";

const LEVEL_LABELS: Record<string, string> = {
    trace: "VERBOSE",
    debug: "DEBUG",
    info: "LOG",
    warn: "WARN",
    error: "ERROR",
};

// ANSI color codes matching NestJS ConsoleLogger (cli-colors.util.js)
const clc = {
    green: (text: string) => `\x1B[32m${text}\x1B[39m`,
    yellow: (text: string) => `\x1B[33m${text}\x1B[39m`,
    red: (text: string) => `\x1B[31m${text}\x1B[39m`,
    magentaBright: (text: string) => `\x1B[95m${text}\x1B[39m`,
    cyanBright: (text: string) => `\x1B[96m${text}\x1B[39m`,
};

const LEVEL_COLORS: Record<string, (text: string) => string> = {
    trace: clc.cyanBright,
    debug: clc.magentaBright,
    info: clc.green,
    warn: clc.yellow,
    error: clc.red,
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    day: "2-digit",
    month: "2-digit",
});

export interface RestateLoggerOptions {
    /** Include stack traces in error output. Default: `false`. */
    stackTraces?: boolean;
}

function getErrorLabel(error: Error): string {
    if (error instanceof TerminalError) return "[TerminalError]";
    if (error instanceof RetryableError) return "[RetryableError]";
    if (error instanceof RestateError) return "[RestateError]";
    return "[Error]";
}

function serializeValue(value: unknown, includeStack: boolean): string {
    if (typeof value === "string") return value;
    if (value instanceof Error) {
        const label = getErrorLabel(value);
        const msg = value.message || "Unknown error";
        const stack = includeStack && value.stack ? `\n${value.stack}` : "";
        return `${label} ${msg}${stack}`;
    }
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}

function formatMessage(message: unknown, optionalParams: unknown[], includeStack: boolean): string {
    const parts = [serializeValue(message, includeStack)];
    for (const param of optionalParams) {
        parts.push(serializeValue(param, includeStack));
    }
    return parts.join(" ");
}

function resolveLogLevel(level: string, message: unknown, optionalParams: unknown[]): string {
    // Match SDK-internal "Invocation suspended" message (from @restatedev/restate-sdk).
    // If the SDK changes this wording, this check may need updating.
    if (
        level === "info" &&
        typeof message === "string" &&
        message.includes("Invocation suspended")
    ) {
        return "debug";
    }
    const error = [message, ...optionalParams].find((p): p is Error => p instanceof Error);
    if (!error) return level;
    if (level === "warn") {
        return error instanceof TerminalError ? "error" : "debug";
    }
    return level;
}

export function createRestateLoggerTransport(options?: RestateLoggerOptions): LoggerTransport {
    const includeStack = options?.stackTraces ?? false;

    return (params: LogMetadata, message?: any, ...optionalParams: any[]) => {
        if (params.replaying) return;

        const timestamp = dateTimeFormatter.format(Date.now());
        const pid = process.pid;
        const context = params.context?.invocationTarget ?? "Restate";
        const effectiveLevel = resolveLogLevel(params.level, message, optionalParams);
        const levelLabel = LEVEL_LABELS[effectiveLevel] ?? "LOG";
        const colorFn = LEVEL_COLORS[effectiveLevel] ?? clc.green;
        const formattedMessage = formatMessage(message, optionalParams, includeStack);

        // Match NestJS ConsoleLogger.formatMessage layout exactly:
        // ${pidMessage}${timestamp} ${formattedLogLevel} ${contextMessage}${output}\n
        const pidSection = `[Nest] ${pid}  - `;
        const output =
            colorFn(pidSection) +
            `${timestamp} ` +
            colorFn(levelLabel.padStart(7)) +
            ` ` +
            clc.yellow(`[${context}] `) +
            colorFn(formattedMessage) +
            "\n";

        if (effectiveLevel === "error") {
            process.stderr.write(output);
        } else {
            process.stdout.write(output);
        }
    };
}
