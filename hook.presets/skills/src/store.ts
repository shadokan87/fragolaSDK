import { createStore, type Store } from "@fragola-ai/agent/store";

import type { ActivatedSkillEntry, ResolvedSkill, SkillsStoreValue } from "./types";

export const SKILLS_STORE_NAMESPACE = "skills";

export type SkillsStoreApi = {
  store: Store<SkillsStoreValue>;
  activate: (resolved: ResolvedSkill) => ActivatedSkillEntry;
  deactivate: (resolvedName: string) => boolean;
  isActive: (resolvedName: string) => boolean;
  list: () => ActivatedSkillEntry[];
};

export function createSkillsStore(initialValue?: SkillsStoreValue): SkillsStoreApi {
  const store = createStore<SkillsStoreValue>(initialValue ?? { activatedSkills: {} }, SKILLS_STORE_NAMESPACE);

  return {
    store,
    activate(resolved) {
      const nextEntry: ActivatedSkillEntry = {
        resolvedName: resolved.resolvedName,
        skillName: resolved.skill.name,
        scope: `skill:${resolved.resolvedName}`,
        activatedAt: new Date().toISOString(),
      };

      store.update((prev) => ({
        ...prev,
        activatedSkills: {
          ...prev.activatedSkills,
          [resolved.resolvedName]: nextEntry,
        },
      }));

      return nextEntry;
    },
    deactivate(resolvedName) {
      if (!store.value.activatedSkills[resolvedName])
        return false;

      store.update((prev) => {
        const activatedSkills = { ...prev.activatedSkills };
        delete activatedSkills[resolvedName];
        return { ...prev, activatedSkills };
      });

      return true;
    },
    isActive(resolvedName) {
      return Boolean(store.value.activatedSkills[resolvedName]);
    },
    list() {
      return Object.values(store.value.activatedSkills);
    },
  };
}
