import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Fragola, type Tool } from "@fragola-ai/agent";
import type { Agent } from "@fragola-ai/agent/agent";
import skills, { type SkillsOptions } from "../../src";
import { simpleGit } from "simple-git";

const REPO_CACHE_ROOT = path.join(tmpdir(), "fragola-hook-skills-repos");

type SkillFixture = {
  name: string;
  description?: string;
  body?: string;
  references?: Record<string, string>;
  assets?: Record<string, string>;
  metadata?: Record<string, string>;
};

export function unwrapSingleFileBlock(content: string) {
  const lines = content.trimEnd().split("\n");
  return lines.slice(1, -1).join("\n");
}

export async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeSegment(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

function renderMetadata(metadata: Record<string, string> | undefined) {
  if (!metadata || Object.keys(metadata).length === 0)
    return "";

  const lines = Object.entries(metadata)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join("\n");

  return `metadata:\n${lines}\n`;
}

async function writeOptionalFiles(baseDir: string, directoryName: "references" | "assets", files: Record<string, string> | undefined) {
  if (!files || Object.keys(files).length === 0)
    return;

  const directoryPath = path.join(baseDir, directoryName);
  await mkdir(directoryPath, { recursive: true });

  await Promise.all(Object.entries(files).map(async ([relativePath, content]) => {
    const filePath = path.join(directoryPath, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }));
}

export async function createSkillSourceFixture(skills: SkillFixture[]) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "fragola-hook-skills-source-"));

  await Promise.all(skills.map(async (skillFixture) => {
    const skillDir = path.join(rootDir, skillFixture.name);
    await mkdir(skillDir, { recursive: true });

    const metadataBlock = renderMetadata(skillFixture.metadata);
    const skillFile = `---
name: ${skillFixture.name}
description: ${skillFixture.description ?? `${skillFixture.name} description`}
${metadataBlock}---

${skillFixture.body ?? "This is a test skill."}
`;

    await writeFile(path.join(skillDir, "SKILL.md"), skillFile, "utf8");
    await writeOptionalFiles(skillDir, "references", skillFixture.references);
    await writeOptionalFiles(skillDir, "assets", skillFixture.assets);
  }));

  return rootDir;
}

export async function ensureClonedRepo(repoUrl: string, cacheKey: string) {
  const repoPath = path.join(REPO_CACHE_ROOT, sanitizeSegment(cacheKey));

  await mkdir(path.dirname(repoPath), { recursive: true });

  if (!await pathExists(repoPath))
    await simpleGit().clone(repoUrl, repoPath, ["--depth", "1"]);

  return repoPath;
}

export async function createAgentWithSkills(options: SkillsOptions, agentName = "skills-test") {
  const fragola = new Fragola({
    apiKey: "test-key",
    model: "test-model",
  });

  const agent = fragola.agent({
    name: agentName,
    description: "test agent",
    instructions: "test instructions",
    //@ts-ignore
  }).use(skills(options), "skills");

  await agent.init();
  return agent;
}

export async function disposeSkillsHook(agent: Agent) {
  await agent.removeHook("skills");
}

export function getTool(agent: Agent, toolName: string): Tool {
  const toolEntry = agent.options.tools?.find((candidate) => candidate.name === toolName);
  if (!toolEntry)
    throw new Error(`Missing tool '${toolName}'.`);

  if (typeof toolEntry.handler !== "function")
    throw new Error(`Tool '${toolName}' uses an unsupported dynamic handler in this test.`);

  return toolEntry;
}

export async function callTool(agent: Agent, toolName: string, params: unknown) {
  const toolEntry = getTool(agent, toolName);
  if (typeof toolEntry.handler !== "function")
    throw new Error(`Tool '${toolName}' is not callable.`);

  return toolEntry.handler(params as never, agent.context as never);
}
