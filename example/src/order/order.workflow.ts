import { Logger } from "@nestjs/common";
import {
    InjectClient,
    type ObjectClient,
    RestateContext,
    Run,
    type ServiceClient,
    Signal,
    TerminalError,
    Workflow,
} from "nestjs-restate";
import { CartObject } from "../cart/cart.object";
import { PaymentService } from "../payment/payment.service";
import type { OrderRequest, OrderResult } from "../shared/interfaces";

/**
 * Durable order workflow — orchestrates payment + fulfillment.
 * Demonstrates:
 *   - @InjectClient(T) typed proxies for cross-service calls
 *   - ctx.run() for durable side effects
 *   - ctx.promise() for external signals (shipment confirmation)
 *   - ctx.key for workflow identity
 *   - NestJS Logger for replay-safe logging (automatic, no setup)
 */
@Workflow({ name: "order", metadata: { revision: "1" } })
export class OrderWorkflow {
    private readonly logger = new Logger(OrderWorkflow.name);

    constructor(
        private readonly ctx: RestateContext,
        @InjectClient(PaymentService) private readonly payment: ServiceClient<PaymentService>,
        @InjectClient(CartObject) private readonly cart: ObjectClient<CartObject>,
    ) {}

    @Run()
    async run(input: OrderRequest): Promise<OrderResult> {
        const orderId = this.ctx.key;

        // 1. Read the user's cart
        const items = await this.cart.key(input.userId).getItems();

        if (items.length === 0) {
            throw new TerminalError("Cart is empty", {
                errorCode: 400,
            });
        }

        const rawTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = Math.round(rawTotal * 100) / 100;

        this.logger.log(`Order ${orderId}: ${items.length} items, total $${total.toFixed(2)}`);

        // 2. Charge payment (durable RPC to PaymentService)
        const charge = await this.payment.charge({ amount: total, currency: "USD" });

        // 3. Wait for shipment confirmation (durable promise — suspends until signaled)
        const trackingNumber = await this.ctx.promise<string>("shipment-confirmed");

        // 4. Clear the user's cart
        await this.cart.key(input.userId).clear();

        this.logger.log(`Order ${orderId} fulfilled — tracking: ${trackingNumber}`);

        return {
            orderId,
            transactionId: charge.transactionId,
            trackingNumber,
            total,
        };
    }

    @Signal()
    async confirmShipment(input: { trackingNumber: string }): Promise<void> {
        if (!input.trackingNumber?.trim()) {
            throw new TerminalError("trackingNumber is required");
        }
        await this.ctx.promise<string>("shipment-confirmed").resolve(input.trackingNumber);
    }
}
