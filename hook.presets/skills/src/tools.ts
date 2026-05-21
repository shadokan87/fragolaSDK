import { tool, type Tool } from "@fragola-ai/agent";
import type { Agent } from "@fragola-ai/agent/agent";
import z from "zod";

import { parseSkillUrl } from "./links";
import { renderSkillPrompt } from "./prompt";
import { readResolvedSkillFiles } from "./readFiles";
import type { SkillsRegistry } from "./registry";
import type { SkillsStoreApi } from "./store";

export type CreateSkillsToolsOptions = {
  agent: Agent;
  registry: SkillsRegistry;
  skillsStore: SkillsStoreApi;
};

export function createSkillsTools(options: CreateSkillsToolsOptions): Tool[] {
  const { agent, registry, skillsStore } = options;

  const listSkills = tool({
    name: "list_skills",
    description: "List available skills, their runtime names, and when to use them",
    schema: z.object({}),
    handler: async () => registry.list().map(({ resolvedName, skill, source }) => ({
      name: resolvedName,
      skillName: skill.name,
      description: skill.description,
      compatibility: skill.compatibility,
      active: skillsStore.isActive(resolvedName),
      source: source.origin,
    })),
  });

  const activateSkill = tool({
    name: "activate_skill",
    description: "Load a skill's SKILL.md into agent instructions and track it in the store",
    schema: z.object({ name: z.string() }),
    handler: async ({ name }) => {
      const skill = registry.getByName(name);
      if (!skill)
        return `Unknown skill: ${name}`;

      agent.context.setInstructions(renderSkillPrompt(skill), `skill:${skill.resolvedName}`);
      skillsStore.activate(skill);
      return `Skill '${skill.resolvedName}' activated from ${skill.localRoot}`;
    },
  });

  const deactivateSkill = tool({
    name: "deactivate_skill",
    description: "Deactivate a skill and remove its instruction scope",
    schema: z.object({ name: z.string() }),
    handler: async ({ name }) => {
      const removed = skillsStore.deactivate(name);
      if (!removed)
        return `Skill '${name}' is not active`;

      agent.context.removeInstructions(`skill:${name}`);
      return `Skill '${name}' deactivated`;
    },
  });

  const readSkillFile = tool({
    name: "read_skill_file",
    description: "Read one or more skill files referenced by skill:// URLs",
    schema: z.object({ files: z.array(z.string()).min(1).max(10) }),
    handler: async ({ files }) => {
      const resolvedFiles = registry.resolveFiles(files);

      for (const url of files) {
        const parsed = parseSkillUrl(url);
        if (!parsed)
          throw new Error(`Invalid skill URL '${url}'.`);

        if (!skillsStore.isActive(parsed.resolvedName))
          throw new Error(`Skill '${parsed.resolvedName}' is not active.`);
      }

      return readResolvedSkillFiles(resolvedFiles);
    },
  });

  return [listSkills, activateSkill, deactivateSkill, readSkillFile];
}
