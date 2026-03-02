import { Module } from "@nestjs/common";
import { RestateModule } from "nestjs-restate";
import { CounterService } from "./counter.service";
import { SignupWorkflow } from "./signup.workflow";
import { UserSessionObject } from "./user-session.object";

@Module({
    imports: [
        RestateModule.forRoot({
            ingress: "http://localhost:8080",
            admin: "http://localhost:9070",
            endpoint: { port: 9080 },
            autoRegister: true,
        }),
    ],
    providers: [CounterService, UserSessionObject, SignupWorkflow],
})
export class AppModule {}
