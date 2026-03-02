import "reflect-metadata";
import { Handler, Run, Shared } from "nestjs-restate";
import { HANDLER_METADATA_KEY } from "nestjs-restate/restate.constants";
import type { HandlerMetadata } from "nestjs-restate/restate.interfaces";

describe("Method Decorators", () => {
    describe("@Run", () => {
        it("should register method as run handler", () => {
            class TestWorkflow {
                @Run()
                async run() {
                    /* noop */
                }
            }

            const handlers: HandlerMetadata[] = Reflect.getMetadata(
                HANDLER_METADATA_KEY,
                TestWorkflow,
            );
            expect(handlers).toContainEqual({ type: "run", methodName: "run" });
        });

        it("should store handler-level options when provided", () => {
            const retryPolicy = { maxAttempts: 3, initialInterval: 100 };

            class TestWorkflow {
                @Run({ retryPolicy })
                async run() {
                    /* noop */
                }
            }

            const handlers: HandlerMetadata[] = Reflect.getMetadata(
                HANDLER_METADATA_KEY,
                TestWorkflow,
            );
            expect(handlers).toHaveLength(1);
            expect(handlers[0].options?.retryPolicy).toEqual(retryPolicy);
        });
    });

    describe("@Handler", () => {
        it("should register method as handler", () => {
            class TestService {
                @Handler()
                async greet() {
                    /* noop */
                }
            }

            const handlers: HandlerMetadata[] = Reflect.getMetadata(
                HANDLER_METADATA_KEY,
                TestService,
            );
            expect(handlers).toContainEqual({ type: "handler", methodName: "greet" });
        });

        it("should store handler-level options when provided", () => {
            class TestService {
                @Handler({
                    retryPolicy: { maxAttempts: 5 },
                    inactivityTimeout: 30_000,
                })
                async process() {
                    /* noop */
                }
            }

            const handlers: HandlerMetadata[] = Reflect.getMetadata(
                HANDLER_METADATA_KEY,
                TestService,
            );
            expect(handlers).toHaveLength(1);
            expect(handlers[0].options?.retryPolicy?.maxAttempts).toBe(5);
            expect(handlers[0].options?.inactivityTimeout).toBe(30_000);
        });
    });

    describe("@Shared", () => {
        it("should register method as shared handler", () => {
            class TestWorkflow {
                @Shared()
                async getStatus() {
                    /* noop */
                }
            }

            const handlers: HandlerMetadata[] = Reflect.getMetadata(
                HANDLER_METADATA_KEY,
                TestWorkflow,
            );
            expect(handlers).toContainEqual({
                type: "shared",
                methodName: "getStatus",
            });
        });

        it("should store handler-level options when provided", () => {
            class TestWorkflow {
                @Shared({ retryPolicy: { maxAttempts: 2 } })
                async getStatus() {
                    /* noop */
                }
            }

            const handlers: HandlerMetadata[] = Reflect.getMetadata(
                HANDLER_METADATA_KEY,
                TestWorkflow,
            );
            expect(handlers[0].options?.retryPolicy?.maxAttempts).toBe(2);
        });
    });

    it("should accumulate multiple handlers on the same class", () => {
        class TestWorkflow {
            @Run()
            async run() {
                /* noop */
            }

            @Shared()
            async acknowledge() {
                /* noop */
            }

            @Shared()
            async getStatus() {
                /* noop */
            }
        }

        const handlers: HandlerMetadata[] = Reflect.getMetadata(HANDLER_METADATA_KEY, TestWorkflow);
        expect(handlers).toHaveLength(3);
        expect(handlers).toContainEqual({ type: "run", methodName: "run" });
        expect(handlers).toContainEqual({
            type: "shared",
            methodName: "acknowledge",
        });
        expect(handlers).toContainEqual({
            type: "shared",
            methodName: "getStatus",
        });
    });

    it("should store undefined options when none provided", () => {
        class TestService {
            @Handler()
            async greet() {
                /* noop */
            }
        }

        const handlers: HandlerMetadata[] = Reflect.getMetadata(HANDLER_METADATA_KEY, TestService);
        expect(handlers[0].options).toBeUndefined();
    });
});
