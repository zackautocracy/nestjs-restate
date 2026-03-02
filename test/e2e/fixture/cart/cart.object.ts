import { Handler, RestateContext, Shared, VirtualObject } from "nestjs-restate";
import type { CartItem } from "../shared/interfaces";

@VirtualObject("cart")
export class CartObject {
    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async addItem(item: CartItem): Promise<CartItem[]> {
        const items = (await this.ctx.get<CartItem[]>("items")) ?? [];
        const existing = items.find((i) => i.productId === item.productId);

        if (existing) {
            existing.quantity += item.quantity;
        } else {
            items.push(item);
        }

        this.ctx.set("items", items);
        return items;
    }

    @Handler()
    async clear(): Promise<void> {
        this.ctx.clearAll();
    }

    @Shared()
    async getItems(): Promise<CartItem[]> {
        return (await this.ctx.get<CartItem[]>("items")) ?? [];
    }
}
