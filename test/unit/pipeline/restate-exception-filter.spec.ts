import {
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    NotFoundException,
    ServiceUnavailableException,
} from "@nestjs/common";
import { TerminalError } from "@restatedev/restate-sdk";
import { RestateExceptionFilter } from "nestjs-restate/pipeline/restate-exception-filter";

const filter = new RestateExceptionFilter();
const mockHost = {} as any;

describe("RestateExceptionFilter", () => {
    describe("TerminalError passthrough", () => {
        it("should rethrow TerminalError as-is", () => {
            const error = new TerminalError("permanent failure");
            try {
                filter.catch(error, mockHost);
            } catch (thrown) {
                expect(thrown).toBe(error);
                expect(thrown).toBeInstanceOf(TerminalError);
                return;
            }
            throw new Error("Expected filter.catch to throw");
        });
    });

    describe("4xx HttpException → TerminalError", () => {
        it("should convert BadRequestException (400) to TerminalError", () => {
            const error = new BadRequestException("bad request");
            expect(() => filter.catch(error, mockHost)).toThrow(TerminalError);
        });

        it("should convert ForbiddenException (403) to TerminalError", () => {
            const error = new ForbiddenException("forbidden");
            expect(() => filter.catch(error, mockHost)).toThrow(TerminalError);
        });

        it("should convert NotFoundException (404) to TerminalError", () => {
            const error = new NotFoundException("not found");
            expect(() => filter.catch(error, mockHost)).toThrow(TerminalError);
        });
    });

    describe("5xx HttpException → rethrown as-is", () => {
        it("should rethrow InternalServerErrorException (500) as-is", () => {
            const error = new InternalServerErrorException("server error");
            try {
                filter.catch(error, mockHost);
            } catch (thrown) {
                expect(thrown).toBe(error);
                expect(thrown).toBeInstanceOf(InternalServerErrorException);
                return;
            }
            throw new Error("Expected filter.catch to throw");
        });

        it("should rethrow ServiceUnavailableException (503) as-is", () => {
            const error = new ServiceUnavailableException("unavailable");
            try {
                filter.catch(error, mockHost);
            } catch (thrown) {
                expect(thrown).toBe(error);
                expect(thrown).toBeInstanceOf(ServiceUnavailableException);
                return;
            }
            throw new Error("Expected filter.catch to throw");
        });
    });

    describe("unknown errors → rethrown as-is", () => {
        it("should rethrow plain Error as-is", () => {
            const error = new Error("something broke");
            try {
                filter.catch(error, mockHost);
            } catch (thrown) {
                expect(thrown).toBe(error);
                return;
            }
            throw new Error("Expected filter.catch to throw");
        });

        it("should rethrow custom errors as-is", () => {
            class CustomError extends Error {
                constructor() {
                    super("custom");
                }
            }
            const error = new CustomError();
            try {
                filter.catch(error, mockHost);
            } catch (thrown) {
                expect(thrown).toBe(error);
                expect(thrown).toBeInstanceOf(CustomError);
                return;
            }
            throw new Error("Expected filter.catch to throw");
        });
    });

    describe("TerminalError wrapping preserves context", () => {
        it("should preserve the original exception message", () => {
            const error = new BadRequestException("validation failed");
            try {
                filter.catch(error, mockHost);
            } catch (thrown) {
                expect(thrown).toBeInstanceOf(TerminalError);
                expect((thrown as TerminalError).message).toBe("validation failed");
                return;
            }
            throw new Error("Expected filter.catch to throw");
        });

        it("should preserve the original exception as cause", () => {
            const error = new NotFoundException("item not found");
            try {
                filter.catch(error, mockHost);
            } catch (thrown) {
                expect(thrown).toBeInstanceOf(TerminalError);
                expect((thrown as TerminalError).cause).toBe(error);
                return;
            }
            throw new Error("Expected filter.catch to throw");
        });
    });
});
