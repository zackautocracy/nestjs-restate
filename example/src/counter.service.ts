import { Handler, RestateContext, Service } from "nestjs-restate";

@Service("counter")
export class CounterService {
    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async add(request: { a: number; b: number }): Promise<number> {
        const sum = request.a + request.b;
        (this.ctx.raw as any).console.log(`Adding ${request.a} + ${request.b} = ${sum}`);
        return sum;
    }
}
