import { defineConfig } from "vitest/config";

export default defineConfig({
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
