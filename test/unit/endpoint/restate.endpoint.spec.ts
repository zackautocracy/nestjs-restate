import * as restate from "@restatedev/restate-sdk";
import { RestateEndpointManager } from "nestjs-restate/endpoint/restate.endpoint";

describe("RestateEndpointManager", () => {
    let manager: RestateEndpointManager;

    beforeEach(() => {
        manager = new RestateEndpointManager();
    });

    it("should start with no definitions", () => {
        expect(manager.getDefinitions()).toEqual([]);
    });

    it("should add a service definition", () => {
        const svc = restate.service({
            name: "test",
            handlers: {
                greet: async () => "hello",
            },
        });

        manager.addDefinition(svc);
        expect(manager.getDefinitions()).toHaveLength(1);
        expect(manager.getDefinitions()[0].name).toBe("test");
    });

    it("should add a workflow definition", () => {
        const wf = restate.workflow({
            name: "test-wf",
            handlers: {
                run: async () => "done",
            },
        });

        manager.addDefinition(wf);
        expect(manager.getDefinitions()).toHaveLength(1);
        expect(manager.getDefinitions()[0].name).toBe("test-wf");
    });

    it("should add a virtual object definition", () => {
        const obj = restate.object({
            name: "test-obj",
            handlers: {
                increment: async () => {},
            },
        });

        manager.addDefinition(obj);
        expect(manager.getDefinitions()).toHaveLength(1);
        expect(manager.getDefinitions()[0].name).toBe("test-obj");
    });

    it("should report null listening port before start", () => {
        expect(manager.getListeningPort()).toBeNull();
    });

    describe("endpoint options", () => {
        it("should start with defaultServiceOptions", async () => {
            const svc = restate.service({
                name: "svc",
                handlers: { greet: async () => "hi" },
            });
            manager.addDefinition(svc);

            const defaultServiceOptions = {
                retryPolicy: { maxAttempts: 3, initialInterval: 200 },
            };

            await manager.start({ port: 0 }, { defaultServiceOptions });

            // If it started without error, the options were accepted
            expect(manager.getListeningPort()).toBeGreaterThan(0);

            await manager.stop();
        });

        it("should start without endpoint options (backward compat)", async () => {
            const svc = restate.service({
                name: "svc",
                handlers: { greet: async () => "hi" },
            });
            manager.addDefinition(svc);

            await manager.start({ port: 0 });

            expect(manager.getListeningPort()).toBeGreaterThan(0);

            await manager.stop();
        });

        it("should reject invalid identityKeys", async () => {
            const svc = restate.service({
                name: "svc",
                handlers: { greet: async () => "hi" },
            });
            manager.addDefinition(svc);

            // SDK validates key format — invalid key should throw
            await expect(
                manager.start(
                    { port: 0 },
                    {
                        identityKeys: ["invalid-key"],
                    },
                ),
            ).rejects.toThrow();
        });
    });
});
