import type * as restate from "@restatedev/restate-sdk";
import { Handler, Shared, VirtualObject } from "nestjs-restate";

@VirtualObject("kv-store")
export class KvStoreObject {
    @Handler()
    async set(ctx: restate.ObjectContext, request: { key: string; value: string }): Promise<void> {
        ctx.set(request.key, request.value);
    }

    @Shared()
    async get(ctx: restate.ObjectSharedContext, key: string): Promise<string | null> {
        return (await ctx.get<string>(key)) ?? null;
    }
}
