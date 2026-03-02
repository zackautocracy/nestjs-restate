import type { KnipConfig } from "knip";

const config: KnipConfig = {
    project: ["lib/**/*.ts"],
    ignoreBinaries: ["pkg-pr-new"],
};

export default config;
