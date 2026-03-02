import { RestateContext, Run, Workflow } from "nestjs-restate";

@Workflow("greeting-workflow")
export class GreetingWorkflow {
    constructor(private readonly ctx: RestateContext) {}

    @Run()
    async run(name: string): Promise<string> {
        const greeting = await this.ctx.run("build-greeting", () => `Hello, ${name}!`);
        const timestamp = await this.ctx.run("add-timestamp", () => new Date().toISOString());
        return `${greeting} (at ${timestamp})`;
    }
}
