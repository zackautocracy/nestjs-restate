import { Module } from "@nestjs/common";
import { RestateModule } from "nestjs-restate";
import { CartModule } from "./cart/cart.module";
import { OrderModule } from "./order/order.module";
import { PaymentModule } from "./payment/payment.module";

@Module({
    imports: [
        RestateModule.forRoot({
            ingress: "http://localhost:8080",
            admin: "http://localhost:9070",
            // For Restate Cloud, uncomment:
            // adminAuthToken: process.env.RESTATE_AUTH_TOKEN,
            // ingressHeaders: { Authorization: `Bearer ${process.env.RESTATE_AUTH_TOKEN}` },
            endpoint: { port: 9080 },
            autoRegister: {
                deploymentUrl: "http://host.docker.internal:9080",
            },
        }),
        PaymentModule,
        CartModule,
        OrderModule,
    ],
})
export class AppModule {}
