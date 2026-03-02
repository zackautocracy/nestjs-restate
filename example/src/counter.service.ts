import type * as restate from "@restatedev/restate-sdk";
import { Handler, Service } from "nestjs-restate";

@Service("counter")
export class CounterService {
    @Handler()
    async add(ctx: restate.Context, request: { a: number; b: number }): Promise<number> {
        const sum = request.a + request.b;
        ctx.console.log(`Adding ${request.a} + ${request.b} = ${sum}`);
        return sum;
    }
}
