#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

const TEMPLATE_DIR = join(import.meta.dir, "template");
const HOOK_PRESETS_DIR = join(import.meta.dir, "../../hook.presets");

async function createHookPreset(name: string, packageName: string) {
  const targetDir = join(HOOK_PRESETS_DIR, name);

  console.log(`Creating hook preset: ${name}`);

  if (existsSync(targetDir)) {
    console.error(`Cannot create hook preset '${name}' because '${targetDir}' already exists.`);
    process.exit(1);
  }

  // Create the target directory
  await $`mkdir -p ${targetDir}`;

  // Copy template files to the target directory
  await $`cp -r ${TEMPLATE_DIR}/* ${targetDir}`;

  // Replace placeholders in package.json
  const packageJsonPath = join(targetDir, "package.json");
  const indexPath = join(targetDir, "src/index.ts");

  await $`sed -i 's/__PACKAGE_NAME__/${packageName}/g' ${packageJsonPath}`;
  await $`sed -i 's/__PRESET_NAME__/${name}/g' ${packageJsonPath}`;
  await $`sed -i 's/__PRESET_NAME__/${name}/g' ${indexPath}`;

  console.log(`Hook preset '${name}' created successfully at ${targetDir}`);
}

// Parse arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: bun create.ts <hook-name> <package-name>");
  process.exit(1);
}

const [hookName, packageName] = args;
await createHookPreset(hookName, packageName);
