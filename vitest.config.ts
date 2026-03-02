import { resolve } from "node:path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        swc.vite({
            module: { type: "es6" },
        }),
    ],
    resolve: {
        alias: {
            "nestjs-restate/": `${resolve(__dirname, "lib")}/`,
            "nestjs-restate": resolve(__dirname, "lib/index.ts"),
        },
    },
    test: {
        globals: true,
        environment: "node",
        include: ["test/unit/**/*.spec.ts"],
        coverage: {
            provider: "istanbul",
            reporter: ["text", "lcov", "json-summary"],
            include: ["lib/**/*.ts"],
            exclude: ["lib/**/index.ts", "lib/**/*.interfaces.ts"],
        },
    },
});
