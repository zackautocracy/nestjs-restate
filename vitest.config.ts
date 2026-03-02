import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        swc.vite({
            module: { type: "es6" },
        }),
    ],
    test: {
        globals: true,
        environment: "node",
        include: ["test/**/*.spec.ts"],
        coverage: {
            provider: "istanbul",
            reporter: ["text", "lcov", "json-summary"],
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts"],
        },
    },
});
