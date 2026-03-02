import { Handler, RestateContext, Service } from "nestjs-restate";
import { PaymentGateway } from "./payment-gateway";

export interface ChargeRequest {
    amount: number;
    currency: string;
}

export interface ChargeResult {
    transactionId: string;
    status: string;
}

export interface RefundRequest {
    transactionId: string;
}

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
        return { transactionId, status: "charged" };
    }

    @Handler()
    async refund(input: RefundRequest): Promise<void> {
        await this.ctx.run("process-refund", () => this.gateway.processRefund(input.transactionId));
    }
}
