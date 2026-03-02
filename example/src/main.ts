import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableShutdownHooks();

    await app.listen(3000);

    console.log("Example app started:");
    console.log("  REST API:         http://localhost:3000");
    console.log("  Restate endpoint: http://localhost:9080");
    console.log("  Restate ingress:  http://localhost:8080");
    console.log("  Admin UI:         http://localhost:9070");
}

bootstrap().catch((error) => {
    console.error("Failed to start example app:", error);
    process.exit(1);
});
