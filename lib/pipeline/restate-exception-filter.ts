import { Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import { TerminalError } from "@restatedev/restate-sdk";

@Catch()
export class RestateExceptionFilter implements ExceptionFilter {
    catch(exception: unknown) {
        if (exception instanceof TerminalError) {
            throw exception;
        }

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            if (status >= 400 && status < 500) {
                throw new TerminalError(exception.message, { cause: exception });
            }
            throw exception;
        }

        throw exception;
    }
}
