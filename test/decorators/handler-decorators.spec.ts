import "reflect-metadata";
import { Handler, Run, Shared } from "../../src/decorators/index";
import { HANDLER_METADATA_KEY } from "../../src/restate.constants";
import type { HandlerMetadata } from "../../src/restate.interfaces";

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
});
