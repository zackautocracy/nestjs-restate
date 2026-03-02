import "reflect-metadata";
import { InjectClient, Service, Workflow } from "nestjs-restate";
import { getClientToken } from "nestjs-restate/proxy/client-token";
import { RESTATE_CLIENT } from "nestjs-restate/restate.constants";
import { describe, expect, it } from "vitest";

@Service("payment")
class PaymentService {}

@Workflow("signup")
class SignupWorkflow {}

describe("@InjectClient", () => {
    describe("no arguments (ingress client)", () => {
        it("should create a parameter decorator without throwing", () => {
            expect(() => {
                class TestService {
                    constructor(@InjectClient() readonly client: any) {
                        void client;
                    }
                }
                expect(TestService).toBeDefined();
            }).not.toThrow();
        });

        it("should inject RESTATE_CLIENT token when called without args", () => {
            class TestService {
                constructor(@InjectClient() readonly client: any) {
                    void client;
                }
            }
            const meta = Reflect.getMetadata("self:paramtypes", TestService);
            expect(meta).toBeDefined();
            expect(meta).toHaveLength(1);
            expect(meta[0].param).toBe(RESTATE_CLIENT);
        });
    });

    describe("with target class (typed proxy)", () => {
        it("should inject the client token for the target class", () => {
            class Consumer {
                constructor(@InjectClient(PaymentService) readonly payment: any) {
                    void payment;
                }
            }
            const meta = Reflect.getMetadata("self:paramtypes", Consumer);
            expect(meta).toBeDefined();
            expect(meta).toHaveLength(1);
            expect(meta[0].param).toBe(getClientToken(PaymentService));
        });

        it("should use different tokens for different target classes", () => {
            class Consumer {
                constructor(
                    @InjectClient(PaymentService) readonly payment: any,
                    @InjectClient(SignupWorkflow) readonly signup: any,
                ) {
                    void payment;
                    void signup;
                }
            }
            const meta = Reflect.getMetadata("self:paramtypes", Consumer);
            expect(meta).toHaveLength(2);
            // NestJS stores parameter metadata in reverse order
            expect(meta[0].param).toBe(getClientToken(SignupWorkflow));
            expect(meta[1].param).toBe(getClientToken(PaymentService));
        });

        it("should work as a property decorator", () => {
            class Consumer {
                @InjectClient(PaymentService) readonly payment: any;
            }
            // Property decorators apply differently — just verify no throws
            expect(Consumer).toBeDefined();
        });
    });
});
