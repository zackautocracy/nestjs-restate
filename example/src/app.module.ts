import { Module } from "@nestjs/common";
import { RestateModule } from "nestjs-restate";
import { CartObject } from "./cart.object";
import { OrderController } from "./order.controller";
import { OrderWorkflow } from "./order.workflow";
import { PaymentService } from "./payment.service";
import { PaymentGateway } from "./payment-gateway";

@Module({
    imports: [
        RestateModule.forRoot({
            ingress: "http://localhost:8080",
            admin: "http://localhost:9070",
            endpoint: { port: 9080 },
            autoRegister: {
                deploymentUrl: "http://host.docker.internal:9080",
            },
            clients: [PaymentService, CartObject, OrderWorkflow],
        }),
    ],
    controllers: [OrderController],
    providers: [PaymentService, CartObject, OrderWorkflow, PaymentGateway],
})
export class AppModule {}
