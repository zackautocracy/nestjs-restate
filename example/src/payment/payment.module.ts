import { Module } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { PaymentGateway } from "./payment-gateway";

@Module({
    providers: [PaymentService, PaymentGateway],
    exports: [PaymentGateway],
})
export class PaymentModule {}
