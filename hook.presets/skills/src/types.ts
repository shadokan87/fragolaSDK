export type SkillSource =
  | { kind: "fs"; path: string }
  | { kind: "github"; repoUrl: string; ref?: string; subdir?: string };

export type Skill = {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string;
  metadata: Record<string, string>;
};

export type SkillLink = {
  label: string;
  url: string;
  localPath: string;
};

export type SkillFileKind = "skill" | "reference" | "asset";

export type ResolvedSkillFile = {
  kind: SkillFileKind;
  relativePath: string;
  absolutePath: string;
  url: string;
};

export type ResolvedSkillSource = {
  kind: "fs" | "github";
  origin: string;
};

export type ResolvedSkill = {
  resolvedName: string;
  skill: Skill;
  localRoot: string;
  skillFile: string;
  body: string;
  renderedBody: string;
  references: ResolvedSkillFile[];
  assets: ResolvedSkillFile[];
  links: SkillLink[];
  source: ResolvedSkillSource;
};

export type ActivatedSkillEntry = {
  resolvedName: string;
  skillName: string;
  scope: `skill:${string}`;
  activatedAt: string;
};

export type SkillsStoreValue = {
  activatedSkills: Record<string, ActivatedSkillEntry>;
};

export type SkillsOptions = {
  sources: SkillSource[];
  cacheDir?: string;
  debug?: boolean;
};
