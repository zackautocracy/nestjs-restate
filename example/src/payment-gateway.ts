import { Injectable } from "@nestjs/common";

/**
 * Simulated payment gateway — a regular NestJS provider (not a Restate component).
 * Demonstrates that standard DI works alongside RestateContext injection.
 */
@Injectable()
export class PaymentGateway {
    async processCharge(amount: number, currency: string): Promise<string> {
        // In a real app this would call Stripe, Braintree, etc.
        return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    async processRefund(transactionId: string): Promise<void> {
        // Simulate refund processing
    }
}
