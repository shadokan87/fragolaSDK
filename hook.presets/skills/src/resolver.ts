import { access } from "node:fs/promises";
import path from "node:path";

import { materializeGithubSource } from "./github";
import type { ResolvedSkillSource, SkillSource } from "./types";

export type ResolvedSourceDirectory = {
  localPath: string;
  source: ResolvedSkillSource;
};

function defaultCacheDir() {
  return path.resolve(process.cwd(), ".fragola/skills-cache");
}

async function assertExists(targetPath: string, message: string) {
  try {
    await access(targetPath);
  } catch {
    throw new Error(message);
  }
}

async function resolveFilesystemSource(source: Extract<SkillSource, { kind: "fs" }>): Promise<ResolvedSourceDirectory> {
  const localPath = path.resolve(source.path);
  await assertExists(localPath, `Skill source path '${localPath}' does not exist.`);

  return {
    localPath,
    source: {
      kind: "fs",
      origin: localPath,
    },
  };
}

async function resolveGithubSource(source: Extract<SkillSource, { kind: "github" }>, cacheDir?: string): Promise<ResolvedSourceDirectory> {
  const resolved = await materializeGithubSource(source, path.resolve(cacheDir ?? defaultCacheDir()));

  return {
    localPath: resolved.localPath,
    source: {
      kind: "github",
      origin: resolved.origin,
    },
  };
}

export async function resolveSkillSources(sources: SkillSource[], cacheDir?: string) {
  return Promise.all(sources.map((source) => {
    if (source.kind === "fs")
      return resolveFilesystemSource(source);

    return resolveGithubSource(source, cacheDir);
  }));
}
