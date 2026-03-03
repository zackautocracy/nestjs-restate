import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { Ingress } from "nestjs-restate";
import { InjectClient } from "nestjs-restate";
import { CartObject } from "../cart/cart.object";
import { PaymentService } from "../payment/payment.service";
import type { CartItem } from "../shared/interfaces";
import { OrderWorkflow } from "./order.workflow";

/**
 * REST controller — exposes the Restate services as a standard HTTP API.
 * Uses the enhanced Ingress client to call Restate components from outside
 * handler context. Pass decorated classes directly — no SDK stubs needed.
 */
@Controller()
export class OrderController {
    constructor(@InjectClient() private readonly ingress: Ingress) {}

    // ── Cart ──

    @Get("cart/:userId")
    async getCart(@Param("userId") userId: string) {
        return this.ingress.objectClient(CartObject, userId).getItems();
    }

    @Post("cart/:userId/items")
    async addToCart(@Param("userId") userId: string, @Body() item: CartItem) {
        return this.ingress.objectClient(CartObject, userId).addItem(item);
    }

    // ── Orders ──

    @Post("orders")
    async createOrder(@Body() body: { userId: string; orderId: string }) {
        await this.ingress
            .workflowClient(OrderWorkflow, body.orderId)
            .workflowSubmit({ userId: body.userId });
        return { orderId: body.orderId, status: "submitted" };
    }

    @Post("orders/:orderId/confirm-shipment")
    async confirmShipment(
        @Param("orderId") orderId: string,
        @Body() body: { trackingNumber: string },
    ) {
        await this.ingress.workflowClient(OrderWorkflow, orderId).confirmShipment(body);
        return { orderId, status: "shipment-confirmed" };
    }

    // ── Payments ──

    @Post("payments/charge")
    async charge(@Body() body: { amount: number; currency: string }) {
        return this.ingress.serviceClient(PaymentService).charge(body);
    }
}
