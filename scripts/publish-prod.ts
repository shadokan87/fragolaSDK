#!/usr/bin/env bun
import path from "node:path";
import bun from "bun";

const PROD_REGISTRY = "https://registry.npmjs.org";

const ANSI = {
    reset: "\u001b[0m",
    green: "\u001b[32m",
    yellow: "\u001b[33m",
    cyan: "\u001b[36m",
    bold: "\u001b[1m",
};

const color = (text: string, tone: keyof typeof ANSI) => `${ANSI[tone]}${text}${ANSI.reset}`;

type CheckTarget = {
    filePath: string,
    className: string,
};

const documentationChecks: CheckTarget[] = [
    { filePath: "src/fragola.ts", className: "Fragola" },
    { filePath: "src/context.ts", className: "Context" },
    { filePath: "src/agent.ts", className: "Agent" },
    { filePath: "src/agentContext.ts", className: "AgentContext" },
];
const documentationFailures: CheckTarget[] = [];

const projectRoot = path.resolve(import.meta.dir, "..");
const checkScriptPath = path.join(projectRoot, "scripts", "check-public-method-comments.ts");
const bunBinary = bun.which("bun") ?? "bun";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const publishArgs = args.filter((arg) => arg !== "--dry");

if (publishArgs.some((arg) => arg === "--registry" || arg.startsWith("--registry="))) {
    console.error(color("Do not pass --registry to publish-prod.ts. This script always publishes to the npm registry.", "yellow"));
    process.exit(1);
}

const runCommand = (commandArgs: string[], label: string) => {
    console.log(`\n${color(label, "bold")}`);
    const result = bun.spawnSync(commandArgs, {
        cwd: projectRoot,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
    });

    return result.exitCode;
};

console.log(color("Preparing production publish", "cyan"));
console.log(`${color("Registry", "cyan")}: ${PROD_REGISTRY}`);
console.log(`${color("Mode", "cyan")}: ${dryRun ? "dry run" : "publish"}`);

for (const target of documentationChecks) {
    const exitCode = runCommand(
        [bunBinary, checkScriptPath, target.filePath, target.className],
        `Checking JSDoc coverage for ${target.className}`,
    );

    if (exitCode !== 0)
        documentationFailures.push(target);
}

if (documentationFailures.length > 0) {
    console.error(`\n${color("JSDoc coverage failed for one or more public classes:", "yellow")}`);
    for (const target of documentationFailures) {
        console.error(color(`  - ${target.className} (${target.filePath})`, "yellow"));
    }
    process.exit(1);
}

const prepublishExitCode = runCommand(["npm", "run", "prepublishOnly"], "Running prepublishOnly");
if (prepublishExitCode !== 0)
    process.exit(prepublishExitCode);

if (dryRun) {
    console.log(`\n${color("Dry run complete. Skipped npm publish.", "green")}`);
    process.exit(0);
}

const publishExitCode = runCommand(
    ["npm", "publish", "--ignore-scripts", "--registry", PROD_REGISTRY, ...publishArgs],
    "Publishing package to npm",
);

if (publishExitCode !== 0)
    process.exit(publishExitCode);