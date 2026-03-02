import { randomUUID } from "node:crypto";
import type * as restate from "@restatedev/restate-sdk";
import { Run, Shared, Workflow } from "nestjs-restate";

interface SignupRequest {
    email: string;
    name: string;
}

@Workflow("signup")
export class SignupWorkflow {
    @Run()
    async run(
        ctx: restate.WorkflowContext,
        request: SignupRequest,
    ): Promise<{ status: string; email: string }> {
        // Step 1: Generate a verification token
        const token = await ctx.run("generate-token", () => randomUUID());
        ctx.console.log(`Verification token for ${request.email}: ${token}`);

        // Step 2: Wait for email verification signal
        const verified = await ctx.promise<boolean>("email-verified");

        if (!verified) {
            return { status: "rejected", email: request.email };
        }

        // Step 3: Complete signup
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
