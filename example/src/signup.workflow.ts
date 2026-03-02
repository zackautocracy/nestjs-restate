import { randomUUID } from "node:crypto";
import { RestateContext, Run, Shared, Workflow } from "nestjs-restate";

interface SignupRequest {
    email: string;
    name: string;
}

@Workflow("signup")
export class SignupWorkflow {
    constructor(private readonly ctx: RestateContext) {}

    @Run()
    async run(request: SignupRequest): Promise<{ status: string; email: string }> {
        // Step 1: Generate a verification token
        const token = await this.ctx.run("generate-token", () => randomUUID());
        (this.ctx.raw as any).console.log(`Verification token for ${request.email}: ${token}`);

        // Step 2: Wait for email verification signal
        const verified = await this.ctx.promise<boolean>("email-verified");

        if (!verified) {
            return { status: "rejected", email: request.email };
        }

        // Step 3: Complete signup
        await this.ctx.run("create-account", () => {
            (this.ctx.raw as any).console.log(
                `Account created for ${request.name} <${request.email}>`,
            );
        });

        return { status: "completed", email: request.email };
    }

    @Shared()
    async verifyEmail(): Promise<void> {
        (this.ctx.raw as any).console.log("Email verification received");
        await this.ctx.promise<boolean>("email-verified").resolve(true);
    }
}
