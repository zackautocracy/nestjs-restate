import "reflect-metadata";
import { networkInterfaces } from "node:os";
import { type INestApplication, Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as restate from "@restatedev/restate-sdk";
import * as clients from "@restatedev/restate-sdk-clients";
import { RestateContainer } from "@restatedev/restate-sdk-testcontainers";
import { RestateModule } from "nestjs-restate";
import { RestateEndpointManager } from "nestjs-restate/endpoint/restate.endpoint";
import type { StartedTestContainer } from "testcontainers";
import { Wait } from "testcontainers";
import { CounterService } from "./app/counter.service";
import { GreetingWorkflow } from "./app/greeting.workflow";
import { KvStoreObject } from "./app/kv-store.object";
import { SignupWorkflow } from "./app/signup.workflow";

// Service definitions for the ingress client.
// These mirror the handlers registered by the NestJS decorators.
const counterDef = restate.service({
    name: "counter",
    handlers: {
        add: async (_ctx: restate.Context, _req: { a: number; b: number }): Promise<number> => 0,
        echo: async (_ctx: restate.Context, _msg: string): Promise<string> => "",
    },
});

const kvStoreDef = restate.object({
    name: "kv-store",
    handlers: {
        set: async (
            _ctx: restate.ObjectContext,
            _req: { key: string; value: string },
        ): Promise<void> => {},
        get: restate.handlers.object.shared(
            async (_ctx: restate.ObjectSharedContext, _key: string): Promise<string | null> => null,
        ),
    },
});

const greetingWfDef = restate.workflow({
    name: "greeting-workflow",
    handlers: {
        run: async (_ctx: restate.WorkflowContext, _name: string): Promise<string> => "",
    },
});

const signupWfDef = restate.workflow({
    name: "signup",
    handlers: {
        run: async (
            _ctx: restate.WorkflowContext,
            _req: { email: string; name: string },
        ): Promise<{ status: string; email: string }> => ({ status: "", email: "" }),
        verifyEmail: restate.handlers.workflow.shared(
            async (_ctx: restate.WorkflowSharedContext): Promise<void> => {},
        ),
    },
});

// Suppress noisy NestJS logs during tests
Logger.overrideLogger(["error", "warn"]);

/**
 * Get the container's IP address on the Docker bridge network.
 * In Docker-in-Docker setups, `host.testcontainers.internal` resolves to the
 * Docker daemon host, not our container. We need our actual container IP since
 * sibling containers communicate via the Docker bridge network.
 */
function getContainerIp(): string {
    const nets = networkInterfaces();
    for (const [name, addrs] of Object.entries(nets)) {
        if (name === "lo" || !addrs) continue;
        for (const addr of addrs) {
            if (addr.family === "IPv4" && !addr.internal) {
                return addr.address;
            }
        }
    }
    throw new Error("Could not determine container IP address");
}

describe("nestjs-restate E2E", () => {
    let app: INestApplication;
    let restateContainer: StartedTestContainer;
    let ingress: clients.Ingress;
    let adminUrl: string;

    beforeAll(async () => {
        // 1. Boot NestJS app FIRST — starts the HTTP/2 endpoint on a random port
        //    Ingress URL is set to a placeholder; we'll create our own client later.
        const moduleRef = await Test.createTestingModule({
            imports: [
                RestateModule.forRoot({
                    ingress: "http://placeholder:8080",
                    endpoint: { port: 0 },
                }),
            ],
            providers: [CounterService, KvStoreObject, GreetingWorkflow, SignupWorkflow],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        // 2. Get the port the endpoint chose
        const endpointManager = app.get(RestateEndpointManager);
        const port = endpointManager.getListeningPort();
        expect(port).toBeDefined();
        expect(port).toBeGreaterThan(0);

        // 3. Expose our container's endpoint to sibling containers
        const containerIp = getContainerIp();

        // 4. Start Restate container
        restateContainer = await new RestateContainer()
            .withExposedPorts(8080, 9070)
            .withWaitStrategy(
                Wait.forAll([Wait.forHttp("/restate/health", 8080), Wait.forHttp("/health", 9070)]),
            )
            .start();

        const ingressUrl = `http://${restateContainer.getHost()}:${restateContainer.getMappedPort(8080)}`;
        adminUrl = `http://${restateContainer.getHost()}:${restateContainer.getMappedPort(9070)}`;

        // 5. Register the NestJS endpoint with Restate
        const registerResponse = await fetch(`${adminUrl}/deployments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                uri: `http://${containerIp}:${port}`,
            }),
        });

        if (!registerResponse.ok) {
            const errorBody = await registerResponse.text();
            throw new Error(
                `Failed to register deployment: ${registerResponse.status} ${errorBody}`,
            );
        }

        const registration = (await registerResponse.json()) as {
            services?: { name: string }[];
        };
        expect(registration.services).toBeDefined();
        expect(registration.services?.length).toBeGreaterThanOrEqual(4);

        // 6. Create ingress client
        ingress = clients.connect({ url: ingressUrl });
    }, 60_000);

    afterAll(async () => {
        await app?.close();
        await restateContainer?.stop();
    }, 30_000);

    describe("Service", () => {
        it("should invoke counter.add and return the sum", async () => {
            const counter = ingress.serviceClient(counterDef);
            const result = await counter.add({ a: 3, b: 7 });
            expect(result).toBe(10);
        });

        it("should invoke counter.echo and return the echoed message", async () => {
            const counter = ingress.serviceClient(counterDef);
            const result = await counter.echo("hello world");
            expect(result).toBe("echo: hello world");
        });
    });

    describe("VirtualObject", () => {
        it("should set and get a value via kv-store", async () => {
            const objectKey = `test-key-${Date.now()}`;
            const kvStore = ingress.objectClient(kvStoreDef, objectKey);

            // Set a value
            await kvStore.set({ key: "mykey", value: "myvalue" });

            // Get the value
            const result = await kvStore.get("mykey");
            expect(result).toBe("myvalue");
        });
    });

    describe("Workflow", () => {
        it("should invoke greeting-workflow.run and return a greeting", async () => {
            const workflowId = `test-wf-${Date.now()}`;
            const wf = ingress.workflowClient(greetingWfDef, workflowId);

            const result = await wf.run("Restate");
            expect(result).toContain("Hello, Restate!");
            expect(result).toContain("(at ");
        });

        it("should complete signup workflow after receiving verifyEmail signal", async () => {
            const workflowId = `signup-${Date.now()}`;
            const wf = ingress.workflowClient(signupWfDef, workflowId);

            // Start the workflow (it will block waiting for the email-verified signal)
            const resultPromise = wf.run({ email: "test@example.com", name: "Test User" });

            // Give the workflow time to start and reach the promise await
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Send the verifyEmail signal
            await wf.verifyEmail();

            // The workflow should now complete
            const result = await resultPromise;
            expect(result.status).toBe("completed");
            expect(result.email).toBe("test@example.com");
        });
    });
});
