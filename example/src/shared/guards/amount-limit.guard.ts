import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";

/**
 * Rejects payments over $10,000.
 * Demonstrates a NestJS guard on a Restate handler — uses the standard
 * switchToRpc() pattern to access the handler input.
 */
@Injectable()
export class AmountLimitGuard implements CanActivate {
    private readonly logger = new Logger(AmountLimitGuard.name);

    canActivate(context: ExecutionContext): boolean {
        if (context.getType() !== "restate") {
            return true;
        }

        const input = context.switchToRpc().getData<{ amount?: number }>();

        if (input?.amount !== undefined && input.amount > 10_000) {
            this.logger.warn(`Rejected: amount ${input.amount} exceeds limit`);
            return false;
        }

        return true;
    }
}
