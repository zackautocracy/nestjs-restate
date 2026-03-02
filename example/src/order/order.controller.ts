import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
    InjectClient,
    type ObjectClient,
    type ServiceClient,
    type WorkflowClient,
} from "nestjs-restate";
import { CartObject } from "../cart/cart.object";
import { PaymentService } from "../payment/payment.service";
import type { CartItem } from "../shared/interfaces";
import { OrderWorkflow } from "./order.workflow";

/**
 * REST controller — exposes the Restate services as a standard HTTP API.
 * Uses @InjectClient(T) typed proxies to call Restate components.
 */
@Controller()
export class OrderController {
    constructor(
        @InjectClient(PaymentService)
        private readonly payment: ServiceClient<PaymentService>,
        @InjectClient(CartObject)
        private readonly cart: ObjectClient<CartObject>,
        @InjectClient(OrderWorkflow)
        private readonly order: WorkflowClient<OrderWorkflow>,
    ) {}

    // ── Cart ──

    @Get("cart/:userId")
    async getCart(@Param("userId") userId: string) {
        return this.cart.key(userId).getItems();
    }

    @Post("cart/:userId/items")
    async addToCart(@Param("userId") userId: string, @Body() item: CartItem) {
        return this.cart.key(userId).addItem(item);
    }

    // ── Orders ──

    @Post("orders")
    async createOrder(@Body() body: { userId: string; orderId: string }) {
        await this.order.key(body.orderId).run({ userId: body.userId });
        return { orderId: body.orderId, status: "submitted" };
    }

    @Post("orders/:orderId/confirm-shipment")
    async confirmShipment(
        @Param("orderId") orderId: string,
        @Body() body: { trackingNumber: string },
    ) {
        await this.order.key(orderId).confirmShipment(body);
        return { orderId, status: "shipment-confirmed" };
    }

    // ── Payments ──

    @Post("payments/charge")
    async charge(@Body() body: { amount: number; currency: string }) {
        return this.payment.charge(body);
    }
}
