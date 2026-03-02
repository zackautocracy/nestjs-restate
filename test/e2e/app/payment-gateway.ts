import { Injectable } from "@nestjs/common";

@Injectable()
export class PaymentGateway {
    async processCharge(amount: number, currency: string): Promise<string> {
        return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    async processRefund(transactionId: string): Promise<void> {
        // Simulate refund processing
    }
}
