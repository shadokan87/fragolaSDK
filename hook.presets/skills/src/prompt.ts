import type { ResolvedSkill } from "./types";

function formatOptionalLine(label: string, value: string | undefined) {
  if (!value)
    return "";

  return `${label}: ${value}`;
}

export function renderSkillsSystemPrompt() {
  return `You can use installed skills when they help with the task.

- Use list_skills to see available skills and when to use them.
- Use activate_skill with the exact runtime name returned by list_skills when a listed skill is relevant.
- When an activated skill contains links like skill://..., use read_skill_file to read one or more linked files.
- Use your existing tools together with skill guidance.
- Keep only relevant skills active; use deactivate_skill when a skill is no longer needed.`;
}

export function renderSkillsCatalog(skills: ResolvedSkill[]) {
  if (skills.length === 0)
    return "No skills are currently available.";

  const lines = skills.flatMap((entry) => {
    const compatibility = formatOptionalLine("compatibility", entry.skill.compatibility);
    return [
      `<skill-summary runtime-name="${entry.resolvedName}" spec-name="${entry.skill.name}">`,
      `description: ${entry.skill.description}`,
      compatibility,
      `references: ${entry.references.length}`,
      `assets: ${entry.assets.length}`,
      `</skill-summary>`,
    ].filter(Boolean);
  });

  return `<skills-catalog>\n${lines.join("\n")}\n</skills-catalog>`;
}

function renderSkillLinks(skill: ResolvedSkill) {
  if (skill.links.length === 0)
    return "";

  return skill.links
    .map((link) => `- ${link.label}: ${link.url}`)
    .join("\n");
}

export function renderSkillPrompt(skill: ResolvedSkill) {
  const optionalLines = [
    formatOptionalLine("license", skill.skill.license),
    formatOptionalLine("compatibility", skill.skill.compatibility),
    formatOptionalLine("allowed-tools", skill.skill.allowedTools),
  ].filter(Boolean);

  const links = renderSkillLinks(skill);

  return [
    `<skill runtime-name="${skill.resolvedName}" spec-name="${skill.skill.name}">`,
    `source: ${skill.source.origin}`,
    `local-root: ${skill.localRoot}`,
    `description: ${skill.skill.description}`,
    ...optionalLines,
    skill.links.length > 0 ? "linked-files:" : "",
    links,
    "SKILL.md:",
    skill.renderedBody,
    "</skill>",
  ]
    .filter(Boolean)
    .join("\n");
}
