import { ConsoleLogger, type LoggerService } from "@nestjs/common";
import { getContextIfAvailable } from "../context/restate-context.store";

export class RestateLoggerService implements LoggerService {
    private readonly fallback = new ConsoleLogger();

    log(message: any, ...optionalParams: any[]) {
        this.dispatch("info", "log", message, optionalParams);
    }

    error(message: any, ...optionalParams: any[]) {
        this.dispatch("error", "error", message, optionalParams);
    }

    warn(message: any, ...optionalParams: any[]) {
        this.dispatch("warn", "warn", message, optionalParams);
    }

    debug(message: any, ...optionalParams: any[]) {
        this.dispatch("debug", "debug", message, optionalParams);
    }

    verbose(message: any, ...optionalParams: any[]) {
        this.dispatch("trace", "verbose", message, optionalParams);
    }

    fatal(message: any, ...optionalParams: any[]) {
        this.dispatch("error", "fatal", message, optionalParams);
    }

    private dispatch(
        consoleMethod: "info" | "warn" | "error" | "debug" | "trace",
        nestLevel: "log" | "error" | "warn" | "debug" | "verbose" | "fatal",
        message: any,
        optionalParams: any[],
    ) {
        const ctx = getContextIfAvailable();
        if (ctx) {
            ctx.console[consoleMethod](message, ...optionalParams);
        } else {
            (this.fallback[nestLevel] as (...args: any[]) => unknown)(message, ...optionalParams);
        }
    }
}
