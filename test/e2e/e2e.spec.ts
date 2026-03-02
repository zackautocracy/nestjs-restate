import "reflect-metadata";
import { networkInterfaces } from "node:os";
import { type INestApplication, Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as restate from "@restatedev/restate-sdk";
import * as clients from "@restatedev/restate-sdk-clients";
import { RestateContainer } from "@restatedev/restate-sdk-testcontainers";
import { RestateEndpointManager } from "nestjs-restate/endpoint/restate.endpoint";
import type { StartedTestContainer } from "testcontainers";
import { Wait } from "testcontainers";
import { FixtureModule } from "./fixture/app.module";
import type { CartItem, ChargeResult } from "./fixture/shared/interfaces";

// Service definitions for the ingress client.
// These mirror the handlers registered by the NestJS decorators.
const paymentDef = restate.service({
    name: "payment",
    handlers: {
        charge: async (
            _ctx: restate.Context,
            _req: { amount: number; currency: string },
        ): Promise<ChargeResult> => ({ transactionId: "", status: "" }),
        refund: async (_ctx: restate.Context, _req: { transactionId: string }): Promise<void> => {},
    },
});

const cartDef = restate.object({
    name: "cart",
    handlers: {
        addItem: async (_ctx: restate.ObjectContext, _item: CartItem): Promise<CartItem[]> => [],
        clear: async (_ctx: restate.ObjectContext): Promise<void> => {},
        getItems: restate.handlers.object.shared(
            async (_ctx: restate.ObjectSharedContext): Promise<CartItem[]> => [],
        ),
    },
});

const orderWfDef = restate.workflow({
    name: "order",
    handlers: {
        run: async (
            _ctx: restate.WorkflowContext,
            _req: { userId: string },
        ): Promise<{
            orderId: string;
            transactionId: string;
            trackingNumber: string;
            total: number;
        }> => ({
            orderId: "",
            transactionId: "",
            trackingNumber: "",
            total: 0,
        }),
        confirmShipment: restate.handlers.workflow.shared(
            async (
                _ctx: restate.WorkflowSharedContext,
                _input: { trackingNumber: string },
            ): Promise<void> => {},
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
        // 1. Boot NestJS app using the fixture module (mirrors the example app structure)
        const moduleRef = await Test.createTestingModule({
            imports: [FixtureModule],
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
        expect(registration.services?.length).toBeGreaterThanOrEqual(3);

        // 6. Create ingress client
        ingress = clients.connect({ url: ingressUrl });
    }, 60_000);

    afterAll(async () => {
        await app?.close();
        // Testcontainers stop can be slow on CI — force-kill after 10s
        await restateContainer?.stop({ timeout: 10_000 });
    }, 120_000);

    describe("Service (PaymentService)", () => {
        it("should charge and return a transaction result", async () => {
            const payment = ingress.serviceClient(paymentDef);
            const result = await payment.charge({ amount: 49.99, currency: "USD" });
            expect(result.transactionId).toMatch(/^txn_/);
            expect(result.status).toBe("charged");
        });

        it("should refund without error", async () => {
            const payment = ingress.serviceClient(paymentDef);
            await expect(payment.refund({ transactionId: "txn_test" })).resolves.toBeUndefined();
        });
    });

    describe("VirtualObject (CartObject)", () => {
        it("should add items and return updated cart", async () => {
            const userId = `user-${Date.now()}`;
            const cart = ingress.objectClient(cartDef, userId);

            const items = await cart.addItem({
                productId: "prod-1",
                name: "Widget",
                price: 9.99,
                quantity: 2,
            });

            expect(items).toHaveLength(1);
            expect(items[0].productId).toBe("prod-1");
            expect(items[0].quantity).toBe(2);
        });

        it("should read items via shared handler", async () => {
            const userId = `user-read-${Date.now()}`;
            const cart = ingress.objectClient(cartDef, userId);

            await cart.addItem({
                productId: "prod-2",
                name: "Gadget",
                price: 19.99,
                quantity: 1,
            });

            const items = await cart.getItems();
            expect(items).toHaveLength(1);
            expect(items[0].name).toBe("Gadget");
        });

        it("should merge quantities for duplicate productIds", async () => {
            const userId = `user-merge-${Date.now()}`;
            const cart = ingress.objectClient(cartDef, userId);

            await cart.addItem({ productId: "prod-3", name: "Gizmo", price: 5.0, quantity: 1 });
            const items = await cart.addItem({
                productId: "prod-3",
                name: "Gizmo",
                price: 5.0,
                quantity: 3,
            });

            expect(items).toHaveLength(1);
            expect(items[0].quantity).toBe(4);
        });
    });

    describe("Workflow (OrderWorkflow) — cross-service calls", () => {
        it("should orchestrate payment + cart via @InjectClient and complete on shipment signal", async () => {
            const userId = `user-order-${Date.now()}`;
            const orderId = `order-${Date.now()}`;

            // 1. Add items to the user's cart
            const cart = ingress.objectClient(cartDef, userId);
            await cart.addItem({ productId: "p1", name: "Book", price: 12.5, quantity: 2 });
            await cart.addItem({ productId: "p2", name: "Pen", price: 3.0, quantity: 1 });

            // 2. Start the order workflow (will block on shipment-confirmed promise)
            const wf = ingress.workflowClient(orderWfDef, orderId);
            const resultPromise = wf.run({ userId });

            // Give the workflow time to reach the promise await
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 3. Confirm shipment to unblock the workflow
            await wf.confirmShipment({ trackingNumber: "TRACK-123" });

            // 4. Await the result
            const result = await resultPromise;
            expect(result.orderId).toBe(orderId);
            expect(result.transactionId).toMatch(/^txn_/);
            expect(result.trackingNumber).toBe("TRACK-123");
            expect(result.total).toBe(28.0); // 12.5*2 + 3.0*1
        });

        it("should clear the cart after order completion", async () => {
            const userId = `user-clear-${Date.now()}`;
            const orderId = `order-clear-${Date.now()}`;

            // Add an item
            const cart = ingress.objectClient(cartDef, userId);
            await cart.addItem({ productId: "p1", name: "Book", price: 10.0, quantity: 1 });

            // Start and complete the order
            const wf = ingress.workflowClient(orderWfDef, orderId);
            const resultPromise = wf.run({ userId });
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await wf.confirmShipment({ trackingNumber: "TRACK-456" });
            await resultPromise;

            // Cart should be empty after order completion
            const items = await cart.getItems();
            expect(items).toHaveLength(0);
        });
    });
});
