import "reflect-metadata";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { RESTATE_CLIENT, RestateModule } from "nestjs-restate";
import { RESTATE_OPTIONS } from "nestjs-restate/restate.constants";

describe("RestateModule", () => {
    describe("forRoot", () => {
        it("should create module with RESTATE_OPTIONS provider", async () => {
            const options = {
                ingress: "http://localhost:8080",
                endpoint: { port: 9080 },
            };

            const module = await Test.createTestingModule({
                imports: [RestateModule.forRoot(options)],
            }).compile();

            const resolvedOptions = module.get(RESTATE_OPTIONS);
            expect(resolvedOptions).toEqual(options);

            await module.close();
        });

        it("should create module with RESTATE_CLIENT provider", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRoot({
                        ingress: "http://localhost:8080",
                        endpoint: { port: 9080 },
                    }),
                ],
            }).compile();

            const client = module.get(RESTATE_CLIENT);
            expect(client).toBeDefined();
            expect(typeof client.serviceClient).toBe("function");
            expect(typeof client.workflowClient).toBe("function");
            expect(typeof client.objectClient).toBe("function");

            await module.close();
        });
    });

    describe("forRootAsync", () => {
        it("should create module with async factory", async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RestateModule.forRootAsync({
                        useFactory: () => ({
                            ingress: "http://localhost:8080",
                            endpoint: { port: 9080 },
                        }),
                    }),
                ],
            }).compile();

            const client = module.get(RESTATE_CLIENT);
            expect(client).toBeDefined();
            expect(typeof client.serviceClient).toBe("function");

            const options = module.get(RESTATE_OPTIONS);
            expect(options.ingress).toBe("http://localhost:8080");

            await module.close();
        });

        it("should support inject dependencies in factory", async () => {
            const CONFIG_TOKEN = "CONFIG";

            @Global()
            @Module({
                providers: [
                    {
                        provide: CONFIG_TOKEN,
                        useValue: { url: "http://custom:8080" },
                    },
                ],
                exports: [CONFIG_TOKEN],
            })
            class ConfigModule {}

            const module = await Test.createTestingModule({
                imports: [
                    ConfigModule,
                    RestateModule.forRootAsync({
                        inject: [CONFIG_TOKEN],
                        useFactory: (config: { url: string }) => ({
                            ingress: config.url,
                            endpoint: { port: 9080 },
                        }),
                    }),
                ],
            }).compile();

            const options = module.get(RESTATE_OPTIONS);
            expect(options.ingress).toBe("http://custom:8080");

            await module.close();
        });
    });
});
