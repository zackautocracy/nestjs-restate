import type { LoggerTransport, LogMetadata } from "@restatedev/restate-sdk";

const LEVEL_LABELS: Record<string, string> = {
    trace: "VERBOSE",
    debug: "DEBUG",
    info: "LOG",
    warn: "WARN",
    error: "ERROR",
};

// ANSI color codes matching NestJS ConsoleLogger
const clc = {
    green: (text: string) => `\x1B[32m${text}\x1B[39m`,
    yellow: (text: string) => `\x1B[33m${text}\x1B[39m`,
    red: (text: string) => `\x1B[31m${text}\x1B[39m`,
    magenta: (text: string) => `\x1B[35m${text}\x1B[39m`,
    cyan: (text: string) => `\x1B[36m${text}\x1B[39m`,
    bold: (text: string) => `\x1B[1m${text}\x1B[22m`,
};

const LEVEL_COLORS: Record<string, (text: string) => string> = {
    trace: clc.magenta,
    debug: clc.magenta,
    info: clc.green,
    warn: clc.yellow,
    error: clc.red,
};

function safeStringify(value: any): string {
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function formatMessage(message: any, optionalParams: any[]): string {
    const parts = [safeStringify(message)];
    for (const param of optionalParams) {
        parts.push(safeStringify(param));
    }
    return parts.join(" ");
}

export function createRestateLoggerTransport(): LoggerTransport {
    return (params: LogMetadata, message?: any, ...optionalParams: any[]) => {
        if (params.replaying) return;

        const timestamp = new Date().toLocaleString("en-US");
        const pid = process.pid;
        const context = params.context?.invocationTarget ?? "Restate";
        const levelLabel = LEVEL_LABELS[params.level] ?? "LOG";
        const colorFn = LEVEL_COLORS[params.level] ?? clc.green;
        const formattedMessage = formatMessage(message, optionalParams);

        // Write directly to stdout/stderr — NEVER use NestJS Logger here
        // to avoid circular delegation (Logger → ctx.console → transport → Logger)
        const output =
            clc.green("[Nest] ") +
            clc.bold(String(pid)) +
            `  - ${timestamp}     ` +
            colorFn(`${levelLabel.padStart(7)} `) +
            clc.yellow(`[${context}] `) +
            colorFn(formattedMessage) +
            "\n";

        if (params.level === "error") {
            process.stderr.write(output);
        } else {
            process.stdout.write(output);
        }
    };
}
