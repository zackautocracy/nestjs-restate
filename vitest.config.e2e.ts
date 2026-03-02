import { resolve } from "node:path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [swc.vite({ module: { type: "es6" } })],
    resolve: {
        alias: {
            "nestjs-restate/": `${resolve(__dirname, "lib")}/`,
            "nestjs-restate": resolve(__dirname, "lib/index.ts"),
        },
    },
    test: {
        globals: true,
        environment: "node",
        include: ["test/e2e/**/*.spec.ts"],
        testTimeout: 60_000,
        hookTimeout: 60_000,
        pool: "forks",
        singleFork: true,
    },
});
