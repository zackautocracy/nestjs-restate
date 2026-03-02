import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import * as restate from "@restatedev/restate-sdk";
import type { Ingress } from "@restatedev/restate-sdk-clients";
import { InjectClient } from "nestjs-restate";
import type { CartItem, ChargeResult, OrderResult } from "../shared/interfaces";

/**
 * SDK definitions for Ingress client calls — mirror the handler signatures
 * of the Restate components. Required for calling services from outside
 * handler context (REST endpoints, cron jobs, etc.).
 *
 * Note: @InjectClient(T) typed proxies only work inside Restate handler
 * methods (they rely on AsyncLocalStorage context). For external callers,
 * use @InjectClient() (no args) to get the Ingress client instead.
 */
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
        ): Promise<OrderResult> => ({
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

/**
 * REST controller — exposes the Restate services as a standard HTTP API.
 * Uses the Ingress client (@InjectClient() with no args) to call Restate
 * components from outside handler context.
 */
@Controller()
export class OrderController {
    constructor(@InjectClient() private readonly ingress: Ingress) {}

    // ── Cart ──

    @Get("cart/:userId")
    async getCart(@Param("userId") userId: string) {
        return this.ingress.objectClient(cartDef, userId).getItems();
    }

    @Post("cart/:userId/items")
    async addToCart(@Param("userId") userId: string, @Body() item: CartItem) {
        return this.ingress.objectClient(cartDef, userId).addItem(item);
    }

    // ── Orders ──

    @Post("orders")
    async createOrder(@Body() body: { userId: string; orderId: string }) {
        // Fire-and-forget: submit the workflow and return immediately.
        // The workflow runs durably in Restate — call confirmShipment to signal it.
        await this.ingress
            .workflowClient(orderWfDef, body.orderId)
            .workflowSubmit({ userId: body.userId });
        return { orderId: body.orderId, status: "submitted" };
    }

    @Post("orders/:orderId/confirm-shipment")
    async confirmShipment(
        @Param("orderId") orderId: string,
        @Body() body: { trackingNumber: string },
    ) {
        await this.ingress.workflowClient(orderWfDef, orderId).confirmShipment(body);
        return { orderId, status: "shipment-confirmed" };
    }

    // ── Payments ──

    @Post("payments/charge")
    async charge(@Body() body: { amount: number; currency: string }) {
        return this.ingress.serviceClient(paymentDef).charge(body);
    }
}
