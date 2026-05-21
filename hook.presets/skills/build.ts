#!/usr/bin/env bun
import { build } from "esbuild";
import { spawn } from "node:child_process";

await build({
  entryPoints: ["./src/index.ts"],
  outdir: "./dist",
  platform: "node",
  target: "node18",
  format: "esm",
  sourcemap: true,
  sourcesContent: true,
  bundle: true,
  packages: "external",
}).catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});

console.log("Generating TypeScript declaration files...");
const tscProcess = spawn("npx", ["tsc", "--project", "tsconfig.build.json"], { stdio: "inherit" });

await new Promise((resolve, reject) => {
  tscProcess.on("close", (code) => {
    if (code === 0) {
      console.log("TypeScript declaration files generated successfully!");
      resolve(code);
      return;
    }

    reject(new Error(`TypeScript compilation failed with code ${code}`));
  });
});

console.log("Build completed!");
