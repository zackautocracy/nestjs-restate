import { Handler, RestateContext, Shared, VirtualObject } from "nestjs-restate";
import type { CartItem } from "./interfaces";

/**
 * Virtual Object — keyed cart state per user.
 * @Handler methods run exclusively (one at a time per key).
 * @Shared methods run concurrently (safe for reads).
 */
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
    async removeItem(productId: string): Promise<CartItem[]> {
        const items = (await this.ctx.get<CartItem[]>("items")) ?? [];
        const filtered = items.filter((i) => i.productId !== productId);
        this.ctx.set("items", filtered);
        return filtered;
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
