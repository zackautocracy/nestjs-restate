import { Handler, Service } from "nestjs-restate";

@Service("counter")
export class CounterService {
    @Handler()
    async add(request: { a: number; b: number }): Promise<number> {
        return request.a + request.b;
    }

    @Handler()
    async echo(message: string): Promise<string> {
        return `echo: ${message}`;
    }
}
