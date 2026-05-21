import { nanoid } from "nanoid";

import { buildSkillUrl, rewriteSkillLinks } from "./links";
import { resolveSkillSources } from "./resolver";
import { findSkillRoots, scanSkillRoot, type ScannedSkill, type ScannedSkillFile } from "./scan";
import type { ResolvedSkill, ResolvedSkillFile, SkillSource } from "./types";

function createResolvedName(skillName: string, usedNames: Set<string>) {
  let resolvedName = skillName;

  while (usedNames.has(resolvedName))
    resolvedName = `${skillName}-${nanoid()}`;

  usedNames.add(resolvedName);
  return resolvedName;
}

function toResolvedFile(file: ScannedSkillFile, resolvedName: string): ResolvedSkillFile {
  return {
    ...file,
    url: buildSkillUrl(resolvedName, file.relativePath),
  };
}

function getSkillFileEntry(skill: ResolvedSkill): ResolvedSkillFile {
  return {
    kind: "skill",
    relativePath: "SKILL.md",
    absolutePath: skill.skillFile,
    url: buildSkillUrl(skill.resolvedName, "SKILL.md"),
  };
}

function toResolvedSkill(scanned: ScannedSkill, resolvedName: string): ResolvedSkill {
  const { renderedBody, links } = rewriteSkillLinks(scanned.body, scanned.localRoot, resolvedName);

  return {
    resolvedName,
    skill: scanned.skill,
    localRoot: scanned.localRoot,
    skillFile: scanned.skillFile,
    body: scanned.body,
    renderedBody,
    references: scanned.references.map((file) => toResolvedFile(file, resolvedName)),
    assets: scanned.assets.map((file) => toResolvedFile(file, resolvedName)),
    links,
    source: scanned.source,
  };
}

export class SkillsRegistry {
  private readonly skillsByName = new Map<string, ResolvedSkill>();
  private readonly filesByUrl = new Map<string, ResolvedSkillFile>();

  constructor(public readonly skills: ResolvedSkill[]) {
    for (const skill of skills) {
      this.skillsByName.set(skill.resolvedName, skill);

      for (const file of [getSkillFileEntry(skill), ...skill.references, ...skill.assets])
        this.filesByUrl.set(file.url, file);
    }
  }

  list() {
    return [...this.skills];
  }

  getByName(resolvedName: string) {
    return this.skillsByName.get(resolvedName);
  }

  getFileByUrl(url: string) {
    return this.filesByUrl.get(url);
  }

  resolveFiles(urls: string[]) {
    return urls.map((url) => {
      const file = this.getFileByUrl(url);
      if (!file)
        throw new Error(`Unknown skill file '${url}'.`);
      return file;
    });
  }
}

export async function loadSkills(sources: SkillSource[], options?: { cacheDir?: string }) {
  const resolvedSources = await resolveSkillSources(sources, options?.cacheDir);
  const scannedSkills: ScannedSkill[] = [];

  for (const resolvedSource of resolvedSources) {
    const skillRoots = await findSkillRoots(resolvedSource.localPath);

    if (skillRoots.length === 0)
      throw new Error(`No skills were found in source '${resolvedSource.source.origin}'.`);

    for (const skillRoot of skillRoots)
      scannedSkills.push(await scanSkillRoot(skillRoot, resolvedSource.source));
  }

  const usedNames = new Set<string>();
  const resolvedSkills = scannedSkills.map((scannedSkill) => {
    const resolvedName = createResolvedName(scannedSkill.skill.name, usedNames);
    return toResolvedSkill(scannedSkill, resolvedName);
  });

  if (resolvedSkills.length === 0)
    throw new Error("No skills were loaded.");

  return new SkillsRegistry(resolvedSkills);
}
