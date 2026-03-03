import { Logger } from "@nestjs/common";
import { Handler, RestateContext, Shared, VirtualObject } from "nestjs-restate";
import type { CartItem } from "../shared/interfaces";

/**
 * Virtual Object — keyed cart state per user.
 * @Handler methods run exclusively (one at a time per key).
 * @Shared methods run concurrently (safe for reads).
 *
 * Uses the standard NestJS Logger — it's automatically replay-safe
 * inside Restate handlers (no extra setup needed).
 */
@VirtualObject("cart")
export class CartObject {
    private readonly logger = new Logger(CartObject.name);

    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async addItem(item: CartItem): Promise<CartItem[]> {
        const items = (await this.ctx.get<CartItem[]>("items")) ?? [];
        const existing = items.find((i) => i.productId === item.productId);

        if (existing) {
            existing.quantity += item.quantity;
            this.logger.log(`Updated quantity for ${item.productId} → ${existing.quantity}`);
        } else {
            items.push(item);
            this.logger.log(`Added ${item.productId} (qty: ${item.quantity})`);
        }

        this.ctx.set("items", items);
        return items;
    }

    @Handler()
    async removeItem(productId: string): Promise<CartItem[]> {
        const items = (await this.ctx.get<CartItem[]>("items")) ?? [];
        const filtered = items.filter((i) => i.productId !== productId);
        this.ctx.set("items", filtered);
        this.logger.log(`Removed ${productId}, ${filtered.length} items remaining`);
        return filtered;
    }

    @Handler()
    async clear(): Promise<void> {
        this.ctx.clearAll();
        this.logger.log("Cart cleared");
    }

    @Shared()
    async getItems(): Promise<CartItem[]> {
        return (await this.ctx.get<CartItem[]>("items")) ?? [];
    }
}
