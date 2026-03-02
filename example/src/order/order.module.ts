import { Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { OrderWorkflow } from "./order.workflow";

@Module({
    providers: [OrderWorkflow],
    controllers: [OrderController],
})
export class OrderModule {}
