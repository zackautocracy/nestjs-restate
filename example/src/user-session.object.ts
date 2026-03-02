import type * as restate from "@restatedev/restate-sdk";
import { Handler, Shared, VirtualObject } from "nestjs-restate";

interface Session {
    userId: string;
    loggedInAt: string;
}

@VirtualObject("user-session")
export class UserSessionObject {
    @Handler()
    async login(ctx: restate.ObjectContext, userId: string): Promise<Session> {
        const session: Session = {
            userId,
            loggedInAt: new Date().toISOString(),
        };
        ctx.set("session", session);
        ctx.console.log(`User ${userId} logged in`);
        return session;
    }

    @Shared()
    async getSession(ctx: restate.ObjectSharedContext): Promise<Session | null> {
        return (await ctx.get<Session>("session")) ?? null;
    }
}
