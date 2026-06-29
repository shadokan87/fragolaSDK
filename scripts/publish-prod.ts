#!/usr/bin/env bun
import path from "node:path";
import bun from "bun";
import * as readline from "node:readline/promises";

const PROD_REGISTRY = "https://registry.npmjs.org";

const ANSI = {
    reset: "\u001b[0m",
    red: "\u001b[31m",
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
    { filePath: "src/store.ts", className: "Store" },
    { filePath: "src/agent.ts", className: "Agent" },
    { filePath: "src/agentContext.ts", className: "AgentContext" },
];
const documentationFailures: CheckTarget[] = [];

const projectRoot = path.resolve(import.meta.dir, "..");
const checkScriptPath = path.join(projectRoot, "scripts", "check-public-method-comments.ts");
const bunBinary = bun.which("bun") ?? "bun";

const dryRun = process.env.npm_config_dry_run === "true";
const registry = process.env.npm_config_registry || PROD_REGISTRY;
const tag = process.env.npm_config_tag || "latest";

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
console.log(`${color("Registry", "cyan")}: ${registry}`);
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

if (dryRun) {
    console.log(`\n${color("Dry run complete. NPM will proceed with dry run publish.", "green")}`);
    process.exit(0);
}

const pkg = await Bun.file(path.join(projectRoot, "package.json")).json();
const packageName = pkg.name;
const packageVersion = pkg.version;

const npmShowResult = bun.spawnSync(["npm", "show", `${packageName}@${tag}`, "version", "--registry", registry]);
const currentNpmVersion = npmShowResult.exitCode === 0
    ? npmShowResult.stdout.toString().trim() || "none"
    : "none (or package not found)";

console.log(`\n${color("Publish Confirmation", "cyan")}`);
console.log(`${color("Package:", "bold")} ${packageName}`);
console.log(`${color("Release Mode (Tag):", "bold")} ${tag}`);
console.log(`${color(`Current NPM Version (${tag}):`, "bold")} ${currentNpmVersion}`);
console.log(`${color("Version to Publish:", "bold")} ${packageVersion}`);

const expectedConfirmation = `${packageName}@${tag}@${packageVersion}`;
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const answer = await rl.question(`\nTo confirm publish, please type exactly:\n${color(expectedConfirmation, "green")}\n> `);
rl.close();

if (answer.trim() !== expectedConfirmation) {
    console.error(color("\nConfirmation failed. Aborting publish.", "red"));
    process.exit(1);
}

console.log(`\n${color("Confirmation successful. Continuing with npm publish...", "green")}`);
