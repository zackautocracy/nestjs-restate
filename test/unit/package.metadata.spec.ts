import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("package metadata", () => {
    it("should publish canonical repository links for npm provenance", () => {
        const packageJson = JSON.parse(
            readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
        );

        expect(packageJson.repository).toEqual({
            type: "git",
            url: "git+https://github.com/razakiau/nestjs-restate.git",
        });
        expect(packageJson.author).toBe("Zakaria O.I.A");
        expect(packageJson.homepage).toBe("https://github.com/razakiau/nestjs-restate#readme");
        expect(packageJson.bugs).toEqual({
            url: "https://github.com/razakiau/nestjs-restate/issues",
        });
    });
});
