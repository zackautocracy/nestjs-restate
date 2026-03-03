import { Logger } from "@nestjs/common";
import { Handler, RestateContext, Service } from "nestjs-restate";
import type { ChargeRequest, ChargeResult, RefundRequest } from "../shared/interfaces";
import { PaymentGateway } from "./payment-gateway";

/**
 * Stateless payment service — durable RPC handlers for charging and refunding.
 * Shows RestateContext + regular NestJS provider injected side by side.
 *
 * Both this.logger (NestJS Logger) and this.ctx.console are replay-safe.
 * Use whichever style you prefer — they produce equivalent output.
 */
@Service("payment")
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private readonly ctx: RestateContext,
        private readonly gateway: PaymentGateway,
    ) {}

    @Handler()
    async charge(input: ChargeRequest): Promise<ChargeResult> {
        this.logger.log(`Charging ${input.amount} ${input.currency}`);

        const transactionId = await this.ctx.run("process-charge", () =>
            this.gateway.processCharge(input.amount, input.currency),
        );

        this.logger.log(`Charge complete → ${transactionId}`);

        return { transactionId, status: "charged" };
    }

    @Handler()
    async refund(input: RefundRequest): Promise<void> {
        this.logger.log(`Processing refund for ${input.transactionId}`);

        await this.ctx.run("process-refund", () => this.gateway.processRefund(input.transactionId));

        this.logger.log(`Refund complete for ${input.transactionId}`);
    }
}
