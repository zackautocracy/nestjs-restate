import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["lib/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
});
