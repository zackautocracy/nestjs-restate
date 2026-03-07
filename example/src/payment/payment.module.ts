import { Module } from "@nestjs/common";
import { AmountLimitGuard } from "../shared/guards/amount-limit.guard";
import { PaymentService } from "./payment.service";
import { PaymentGateway } from "./payment-gateway";

@Module({
    providers: [PaymentService, PaymentGateway, AmountLimitGuard],
    exports: [PaymentGateway],
})
export class PaymentModule {}
