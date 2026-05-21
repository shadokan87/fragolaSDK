import type { FragolaHook } from "@fragola-ai/agent/hook";

import { renderSkillsCatalog, renderSkillsSystemPrompt } from "./prompt";
import { loadSkills } from "./registry";
import { createSkillsStore, SKILLS_STORE_NAMESPACE } from "./store";
import { createSkillsTools } from "./tools";
import type { Skill, SkillsOptions, SkillSource, ResolvedSkill } from "./types";

const SYSTEM_SCOPE = "skills:system";
const CATALOG_SCOPE = "skills:catalog";

function assertValidOptions(options: SkillsOptions) {
  if (!Array.isArray(options.sources) || options.sources.length === 0)
    throw new Error("skills hook requires at least one source.");
}

export type { Skill, SkillsOptions, SkillSource, ResolvedSkill };

export const skills = (options: SkillsOptions): FragolaHook => {
  return async (agent) => {
    assertValidOptions(options);

    if (agent.context.getStore(SKILLS_STORE_NAMESPACE))
      throw new Error("skills hook is already installed on this agent.");

    const registry = await loadSkills(options.sources, { cacheDir: options.cacheDir });
    const skillsStore = createSkillsStore();
    const addedTools = createSkillsTools({
      agent,
      registry,
      skillsStore,
    });

    agent.context.addStore(skillsStore.store);
    agent.context.setInstructions(renderSkillsSystemPrompt(), SYSTEM_SCOPE);
    agent.context.setInstructions(renderSkillsCatalog(registry.list()), CATALOG_SCOPE);
    agent.context.updateTools((prev) => [...prev, ...addedTools]);

    if (options.debug)
      console.debug("[hook-skills] loaded", registry.list().map((skill) => skill.resolvedName));

    return () => {
      const activeScopes = skillsStore.list().map((entry) => entry.scope);

      agent.context.updateTools((prev) => prev.filter((toolEntry) => !addedTools.includes(toolEntry)));
      for (const scope of [SYSTEM_SCOPE, CATALOG_SCOPE, ...activeScopes])
        agent.context.removeInstructions(scope);
      agent.context.removeStore(SKILLS_STORE_NAMESPACE);
    };
  };
};

export default skills;