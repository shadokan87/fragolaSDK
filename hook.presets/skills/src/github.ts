import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { simpleGit } from "simple-git";

import type { SkillSource } from "./types";

type GithubSkillSource = Extract<SkillSource, { kind: "github" }>;

type ParsedGithubSource = {
  cloneSource: string;
  cachePath: string;
  ref?: string;
  subdir?: string;
};

function sanitizePathSegment(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeSubdir(subdir: string) {
  const normalized = path.posix.normalize(subdir.replaceAll("\\", "/")).replace(/^\.\//, "");

  if (!normalized || normalized === "." || normalized.startsWith("../"))
    throw new Error(`Invalid GitHub skill subdir '${subdir}'.`);

  return normalized;
}

function tryParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseGithubSource(source: GithubSkillSource, cacheDir: string): ParsedGithubSource {
  const url = tryParseUrl(source.repoUrl);

  let ref = source.ref;
  let subdir = source.subdir ? normalizeSubdir(source.subdir) : undefined;
  let cloneSource = source.repoUrl;

  if (url) {
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com")
      throw new Error(`Unsupported GitHub host '${url.hostname}'. Only github.com URLs are supported.`);

    const pathSegments = url.pathname
      .replace(/^\//, "")
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    if (pathSegments.length < 2)
      throw new Error(`Invalid GitHub repository URL '${source.repoUrl}'.`);

    if (pathSegments[2] === "tree" && pathSegments[3]) {
      const owner = pathSegments[0];
      const repo = pathSegments[1];

      ref ??= pathSegments[3];
      if (!subdir && pathSegments.length > 4)
        subdir = normalizeSubdir(pathSegments.slice(4).join("/"));
      cloneSource = `${url.protocol}//github.com/${owner}/${repo}.git`;
    }
  }

  const cacheKey = sanitizePathSegment(source.repoUrl.replace(/\.git$/, ""));
  const cacheRef = ref ? sanitizePathSegment(ref) : "default";

  return {
    cloneSource,
    cachePath: path.join(cacheDir, cacheKey, cacheRef),
    ref,
    subdir,
  };
}

export async function materializeGithubSource(source: GithubSkillSource, cacheDir: string) {
  const parsed = parseGithubSource(source, cacheDir);

  await mkdir(path.dirname(parsed.cachePath), { recursive: true });

  if (!await pathExists(parsed.cachePath)) {
    const cloneOptions = ["--depth", "1"];

    if (parsed.ref)
      cloneOptions.push("--branch", parsed.ref);

    try {
      await simpleGit().clone(parsed.cloneSource, parsed.cachePath, cloneOptions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to clone '${parsed.cloneSource}' into '${parsed.cachePath}': ${message}`);
    }
  }

  const localPath = parsed.subdir
    ? path.join(parsed.cachePath, parsed.subdir)
    : parsed.cachePath;

  if (!await pathExists(localPath))
    throw new Error(`Resolved GitHub skill path '${localPath}' does not exist.`);

  return {
    localPath,
    origin: source.repoUrl,
  };
}
