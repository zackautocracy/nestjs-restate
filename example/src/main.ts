import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    app.enableShutdownHooks();

    console.log("Example app started — Restate endpoint on port 9080");
    console.log("Send requests via Restate ingress at http://localhost:8080");
    console.log("Admin UI at http://localhost:9070");
}

bootstrap().catch((error) => {
    console.error("Failed to start example app:", error);
    process.exit(1);
});
