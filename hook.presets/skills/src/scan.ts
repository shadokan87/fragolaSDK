import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { isAllowedSkillRelativePath } from "./links";
import type { ResolvedSkillSource, Skill, SkillFileKind } from "./types";

const SKILL_FILE_NAME = "SKILL.md";
const SKILL_NAME_PATTERN = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

type FrontmatterParseResult = {
  frontmatter: Record<string, string | Record<string, string>>;
  body: string;
};

export type ScannedSkillFile = {
  kind: SkillFileKind;
  relativePath: string;
  absolutePath: string;
};

export type ScannedSkill = {
  skill: Skill;
  localRoot: string;
  skillFile: string;
  body: string;
  references: ScannedSkillFile[];
  assets: ScannedSkillFile[];
  source: ResolvedSkillSource;
};

function normalizeLineEndings(content: string) {
  return content.replaceAll("\r\n", "\n");
}

function stripQuotes(value: string) {
  const trimmed = value.trim();

  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
    return trimmed.slice(1, -1);

  return trimmed;
}

function parseFrontmatter(content: string): FrontmatterParseResult {
  const normalized = normalizeLineEndings(content);

  if (!normalized.startsWith("---\n")) {
    return {
      frontmatter: {},
      body: normalized,
    };
  }

  const endIndex = normalized.indexOf("\n---\n", 4);

  if (endIndex === -1)
    throw new Error(`Invalid ${SKILL_FILE_NAME}: missing closing frontmatter delimiter.`);

  const frontmatterBlock = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 5).trimStart();
  const lines = frontmatterBlock.split("\n");
  const frontmatter: Record<string, string | Record<string, string>> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim())
      continue;

    if (line.startsWith("  "))
      throw new Error(`Invalid ${SKILL_FILE_NAME}: unexpected indentation in frontmatter.`);

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1)
      throw new Error(`Invalid ${SKILL_FILE_NAME}: malformed frontmatter line '${line}'.`);

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (rawValue.length > 0) {
      frontmatter[key] = stripQuotes(rawValue);
      continue;
    }

    const nestedValue: Record<string, string> = {};
    while (index + 1 < lines.length && lines[index + 1].startsWith("  ")) {
      index += 1;
      const nestedLine = lines[index].trim();
      if (!nestedLine)
        continue;

      const nestedSeparatorIndex = nestedLine.indexOf(":");
      if (nestedSeparatorIndex === -1)
        throw new Error(`Invalid ${SKILL_FILE_NAME}: malformed nested frontmatter line '${nestedLine}'.`);

      const nestedKey = nestedLine.slice(0, nestedSeparatorIndex).trim();
      const nestedRawValue = nestedLine.slice(nestedSeparatorIndex + 1).trim();
      nestedValue[nestedKey] = stripQuotes(nestedRawValue);
    }

    frontmatter[key] = nestedValue;
  }

  return {
    frontmatter,
    body,
  };
}

function parseSkill(frontmatter: Record<string, string | Record<string, string>>, localRoot: string): Skill {
  const name = typeof frontmatter.name === "string" ? frontmatter.name : undefined;
  const description = typeof frontmatter.description === "string" ? frontmatter.description : undefined;

  if (!name)
    throw new Error(`Invalid ${SKILL_FILE_NAME}: missing required 'name' field.`);

  if (!SKILL_NAME_PATTERN.test(name))
    throw new Error(`Invalid ${SKILL_FILE_NAME}: '${name}' is not a valid skill name.`);

  const expectedDirectoryName = path.basename(localRoot);
  if (expectedDirectoryName !== name)
    throw new Error(`Invalid ${SKILL_FILE_NAME}: parent directory '${expectedDirectoryName}' must match skill name '${name}'.`);

  if (!description || description.length > 1024)
    throw new Error(`Invalid ${SKILL_FILE_NAME}: missing or invalid 'description' field.`);

  const metadata = typeof frontmatter.metadata === "object" && frontmatter.metadata !== null
    ? frontmatter.metadata as Record<string, string>
    : {};

  return {
    name,
    description,
    license: typeof frontmatter.license === "string" ? frontmatter.license : undefined,
    compatibility: typeof frontmatter.compatibility === "string" ? frontmatter.compatibility : undefined,
    allowedTools: typeof frontmatter["allowed-tools"] === "string" ? frontmatter["allowed-tools"] : undefined,
    metadata,
  };
}

async function walkAllowedFiles(rootPath: string, directory: string, kind: SkillFileKind): Promise<ScannedSkillFile[]> {
  const files: ScannedSkillFile[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walkAllowedFiles(rootPath, absolutePath, kind));
      continue;
    }

    const relativePath = path.relative(rootPath, absolutePath).replaceAll("\\", "/");
    if (!isAllowedSkillRelativePath(relativePath))
      continue;

    files.push({
      kind,
      relativePath,
      absolutePath,
    });
  }

  return files;
}

async function listOptionalFiles(localRoot: string, directoryName: "references" | "assets", kind: SkillFileKind) {
  const directoryPath = path.join(localRoot, directoryName);

  try {
    await access(directoryPath);
  } catch {
    return [];
  }

  return walkAllowedFiles(localRoot, directoryPath, kind);
}

export async function findSkillRoots(sourcePath: string) {
  const rootSkillFile = path.join(sourcePath, SKILL_FILE_NAME);

  try {
    await access(rootSkillFile);
    return [sourcePath];
  } catch {
    const entries = await readdir(sourcePath, { withFileTypes: true });
    const roots = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const candidatePath = path.join(sourcePath, entry.name);

        try {
          await access(path.join(candidatePath, SKILL_FILE_NAME));
          return candidatePath;
        } catch {
          return null;
        }
      }));

    return roots.filter((root): root is string => Boolean(root));
  }
}

export async function scanSkillRoot(localRoot: string, source: ResolvedSkillSource): Promise<ScannedSkill> {
  const skillFile = path.join(localRoot, SKILL_FILE_NAME);
  const content = await readFile(skillFile, "utf8");
  const { frontmatter, body } = parseFrontmatter(content);
  const skill = parseSkill(frontmatter, localRoot);
  const references = await listOptionalFiles(localRoot, "references", "reference");
  const assets = await listOptionalFiles(localRoot, "assets", "asset");

  return {
    skill,
    localRoot,
    skillFile,
    body,
    references,
    assets,
    source,
  };
}
