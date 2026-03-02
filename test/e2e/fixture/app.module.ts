import { Module } from "@nestjs/common";
import { RestateModule } from "nestjs-restate";
import { CartObject } from "./cart/cart.object";
import { OrderWorkflow } from "./order/order.workflow";
import { PaymentService } from "./payment/payment.service";
import { PaymentGateway } from "./payment/payment-gateway";

/**
 * E2E test fixture module — mirrors the example app structure.
 * Composes all Restate components + a regular NestJS provider (PaymentGateway).
 */
@Module({
    imports: [
        RestateModule.forRoot({
            ingress: "http://placeholder:8080",
            endpoint: { port: 0 },
        }),
    ],
    providers: [PaymentGateway, PaymentService, CartObject, OrderWorkflow],
})
export class FixtureModule {}
