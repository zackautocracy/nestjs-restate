import type * as restate from "@restatedev/restate-sdk";
import { Run, Shared, Workflow } from "nestjs-restate";

@Workflow("signup")
export class SignupWorkflow {
    @Run()
    async run(
        ctx: restate.WorkflowContext,
        request: { email: string; name: string },
    ): Promise<{ status: string; email: string }> {
        const token = await ctx.run("generate-token", () =>
            Math.random().toString(36).substring(2, 10),
        );

        ctx.console.log(`Verification token for ${request.email}: ${token}`);

        // Wait for the email-verified signal
        const verified = await ctx.promise<boolean>("email-verified");

        if (!verified) {
            return { status: "rejected", email: request.email };
        }

        await ctx.run("create-account", () => {
            ctx.console.log(`Account created for ${request.name} <${request.email}>`);
        });

        return { status: "completed", email: request.email };
    }

    @Shared()
    async verifyEmail(ctx: restate.WorkflowSharedContext): Promise<void> {
        ctx.console.log("Email verification received");
        await ctx.promise<boolean>("email-verified").resolve(true);
    }
}
