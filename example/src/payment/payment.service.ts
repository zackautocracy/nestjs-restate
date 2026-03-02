import { Handler, RestateContext, Service } from "nestjs-restate";
import type { ChargeRequest, ChargeResult, RefundRequest } from "../shared/interfaces";
import { PaymentGateway } from "./payment-gateway";

/**
 * Stateless payment service — durable RPC handlers for charging and refunding.
 * Shows RestateContext + regular NestJS provider injected side by side.
 */
@Service("payment")
export class PaymentService {
    constructor(
        private readonly ctx: RestateContext,
        private readonly gateway: PaymentGateway,
    ) {}

    @Handler()
    async charge(input: ChargeRequest): Promise<ChargeResult> {
        const transactionId = await this.ctx.run("process-charge", () =>
            this.gateway.processCharge(input.amount, input.currency),
        );

        this.ctx.console.log(`Charged ${input.amount} ${input.currency} → ${transactionId}`);

        return { transactionId, status: "charged" };
    }

    @Handler()
    async refund(input: RefundRequest): Promise<void> {
        await this.ctx.run("process-refund", () => this.gateway.processRefund(input.transactionId));

        this.ctx.console.log(`Refunded ${input.transactionId}`);
    }
}
