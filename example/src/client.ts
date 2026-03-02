/**
 * Interactive client for the example app using @restatedev/restate-sdk-clients.
 *
 * Usage:
 *   yarn example:client
 *
 * Requires the example app and Restate server to be running:
 *   yarn docker:up && yarn example:dev
 */
import * as clients from "@restatedev/restate-sdk-clients";

const INGRESS_URL = process.env.RESTATE_INGRESS_URL ?? "http://localhost:8080";

async function main() {
    const restate = clients.connect({ url: INGRESS_URL });

    console.log(`Connected to Restate ingress at ${INGRESS_URL}\n`);

    // ── Counter Service (stateless RPC) ──────────────────────────────
    console.log("=== Counter Service ===");
    const counter = restate.serviceClient<{
        add: (req: { a: number; b: number }) => Promise<number>;
    }>({
        name: "counter",
    });
    const sum = await counter.add({ a: 3, b: 7 });
    console.log(`counter.add(3, 7) = ${sum}\n`);

    // ── User Session (Virtual Object with keyed state) ───────────────
    console.log("=== User Session (Virtual Object) ===");
    const session = restate.objectClient<{
        login: (userId: string) => Promise<{ userId: string; loggedInAt: string }>;
        getSession: () => Promise<{ userId: string; loggedInAt: string } | null>;
    }>({ name: "user-session" }, "alice");

    const loginResult = await session.login("alice");
    console.log("session.login('alice') =", loginResult);

    const currentSession = await session.getSession();
    console.log("session.getSession() =", currentSession, "\n");

    // ── Signup Workflow (durable execution with signals) ─────────────
    console.log("=== Signup Workflow ===");
    const signup = restate.workflowClient<{
        run: (req: { email: string; name: string }) => Promise<{ status: string; email: string }>;
        verifyEmail: () => Promise<void>;
    }>({ name: "signup" }, `user-${Date.now()}`);

    // Submit the workflow (non-blocking start)
    await signup.workflowSubmit({ email: "test@example.com", name: "Test User" });
    console.log("Workflow submitted, waiting for it to reach the verification step...");

    // Give it a moment to reach the promise, then send the verification signal
    await new Promise((r) => setTimeout(r, 1000));
    await signup.verifyEmail();
    console.log("Verification signal sent!");

    // Wait for the workflow to complete
    const result = await signup.workflowAttach();
    console.log("Workflow result:", result, "\n");

    console.log("All examples completed successfully!");
}

main().catch((err) => {
    console.error("Error:", err.message ?? err);
    process.exit(1);
});
