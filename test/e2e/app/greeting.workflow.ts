import type * as restate from "@restatedev/restate-sdk";
import { Run, Workflow } from "nestjs-restate";

@Workflow("greeting-workflow")
export class GreetingWorkflow {
    @Run()
    async run(ctx: restate.WorkflowContext, name: string): Promise<string> {
        const greeting = await ctx.run("build-greeting", () => `Hello, ${name}!`);
        const timestamp = await ctx.run("add-timestamp", () => new Date().toISOString());
        return `${greeting} (at ${timestamp})`;
    }
}
