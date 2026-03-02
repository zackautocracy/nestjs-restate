import type * as restate from "@restatedev/restate-sdk";
import { Handler, Service } from "nestjs-restate";

@Service("counter")
export class CounterService {
    @Handler()
    async add(ctx: restate.Context, request: { a: number; b: number }): Promise<number> {
        return request.a + request.b;
    }

    @Handler()
    async echo(ctx: restate.Context, message: string): Promise<string> {
        return `echo: ${message}`;
    }
}
