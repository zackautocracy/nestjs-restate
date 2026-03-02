import { Handler, RestateContext, Shared, VirtualObject } from "nestjs-restate";

@VirtualObject("kv-store")
export class KvStoreObject {
    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async set(request: { key: string; value: string }): Promise<void> {
        this.ctx.set(request.key, request.value);
    }

    @Shared()
    async get(key: string): Promise<string | null> {
        return (await this.ctx.get<string>(key)) ?? null;
    }
}
