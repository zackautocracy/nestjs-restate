import "reflect-metadata";
import { InjectClient } from "../../src/decorators/index";

describe("@InjectClient", () => {
    it("should create a parameter decorator without throwing", () => {
        expect(() => {
            class TestService {
                constructor(@InjectClient() readonly client: any) {
                    // noop — just verifying the decorator applies
                    void client;
                }
            }
            expect(TestService).toBeDefined();
        }).not.toThrow();
    });

    it("should set injection metadata on the constructor parameter", () => {
        class TestService {
            constructor(@InjectClient() readonly client: any) {
                void client;
            }
        }

        // NestJS Inject stores metadata under 'self:paramtypes'
        const meta = Reflect.getMetadata("self:paramtypes", TestService);
        expect(meta).toBeDefined();
        expect(meta).toHaveLength(1);
        expect(meta[0].param).toBeDefined();
    });
});
