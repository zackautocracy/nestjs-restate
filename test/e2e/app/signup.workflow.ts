import { RestateContext, Run, Shared, Workflow } from "nestjs-restate";

@Workflow("signup")
export class SignupWorkflow {
    constructor(private readonly ctx: RestateContext) {}

    @Run()
    async run(request: {
        email: string;
        name: string;
    }): Promise<{ status: string; email: string }> {
        const token = await this.ctx.run("generate-token", () =>
            Math.random().toString(36).substring(2, 10),
        );

        (this.ctx.raw as any).console.log(`Verification token for ${request.email}: ${token}`);

        // Wait for the email-verified signal
        const verified = await this.ctx.promise<boolean>("email-verified");

        if (!verified) {
            return { status: "rejected", email: request.email };
        }

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
