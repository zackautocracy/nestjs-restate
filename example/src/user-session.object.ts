import { Handler, RestateContext, Shared, VirtualObject } from "nestjs-restate";

interface Session {
    userId: string;
    loggedInAt: string;
}

@VirtualObject("user-session")
export class UserSessionObject {
    constructor(private readonly ctx: RestateContext) {}

    @Handler()
    async login(userId: string): Promise<Session> {
        const session: Session = {
            userId,
            loggedInAt: new Date().toISOString(),
        };
        this.ctx.set("session", session);
        (this.ctx.raw as any).console.log(`User ${userId} logged in`);
        return session;
    }

    @Shared()
    async getSession(): Promise<Session | null> {
        return (await this.ctx.get<Session>("session")) ?? null;
    }
}
