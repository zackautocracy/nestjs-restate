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
            // For Restate Cloud, use structured config:
            // ingress: {
            //     url: process.env.RESTATE_INGRESS_URL,
            //     headers: { Authorization: `Bearer ${process.env.RESTATE_AUTH_TOKEN}` },
            // },
            // admin: {
            //     url: process.env.RESTATE_ADMIN_URL,
            //     authToken: process.env.RESTATE_AUTH_TOKEN,
            // },
            endpoint: { port: 9080 },
            autoRegister: {
                deploymentUrl: "http://host.docker.internal:9080",
                onDeploymentMetadataChange: async (changes) => {
                    for (const change of changes) {
                        console.log(
                            `[deploy] ${change.serviceName} (${change.type}): ` +
                                `${JSON.stringify(change.oldMetadata)} → ${JSON.stringify(change.newMetadata)}`,
                        );
                    }
                },
            },
        }),
        PaymentModule,
        CartModule,
        OrderModule,
    ],
})
export class AppModule {}
