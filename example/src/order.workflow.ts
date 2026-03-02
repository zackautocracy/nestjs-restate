import {
    InjectClient,
    type ObjectClient,
    RestateContext,
    Run,
    type ServiceClient,
    Shared,
    Workflow,
} from "nestjs-restate";
import { CartObject } from "./cart.object";
import type { OrderRequest, OrderResult } from "./interfaces";
import { PaymentService } from "./payment.service";

/**
 * Durable order workflow — orchestrates payment + fulfillment.
 * Demonstrates:
 *   - @InjectClient(T) typed proxies for cross-service calls
 *   - ctx.run() for durable side effects
 *   - ctx.promise() for external signals (shipment confirmation)
 *   - ctx.key() for workflow identity
 */
@Workflow("order")
export class OrderWorkflow {
    constructor(
        private readonly ctx: RestateContext,
        @InjectClient(PaymentService) private readonly payment: ServiceClient<PaymentService>,
        @InjectClient(CartObject) private readonly cart: ObjectClient<CartObject>,
    ) {}

    @Run()
    async run(input: OrderRequest): Promise<OrderResult> {
        const orderId = this.ctx.key();

        // 1. Read the user's cart
        const items = await this.cart.key(input.userId).getItems();

        if (items.length === 0) {
            throw new Error(`Cart is empty for user ${input.userId}`);
        }

        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        (this.ctx.raw as any).console.log(
            `Order ${orderId}: ${items.length} items, total $${total.toFixed(2)}`,
        );

        // 2. Charge payment (durable RPC to PaymentService)
        const charge = await this.payment.charge({ amount: total, currency: "USD" });

        // 3. Wait for shipment confirmation (durable promise — suspends until signaled)
        const trackingNumber = await this.ctx.promise<string>("shipment-confirmed");

        // 4. Clear the user's cart
        await this.cart.key(input.userId).clear();

        (this.ctx.raw as any).console.log(
            `Order ${orderId} fulfilled — tracking: ${trackingNumber}`,
        );

        return {
            orderId,
            transactionId: charge.transactionId,
            trackingNumber,
            total,
        };
    }

    @Shared()
    async confirmShipment(input: { trackingNumber: string }): Promise<void> {
        await this.ctx.promise<string>("shipment-confirmed").resolve(input.trackingNumber);
    }
}
