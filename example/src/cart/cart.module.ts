import { Module } from "@nestjs/common";
import { CartObject } from "./cart.object";

@Module({
    providers: [CartObject],
})
export class CartModule {}
