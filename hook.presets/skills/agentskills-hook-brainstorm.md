# Agent Skills Hook Brainstorm

## Scope

Support the spec parts that map well to a Fragola hook:

- `SKILL.md` frontmatter + body
- progressive disclosure
- `references/`
- `assets/`
- relative markdown links from `SKILL.md`

Skip in v1:

- `scripts/`
- arbitrary extra files outside `SKILL.md`, `references/`, and `assets/`

## Core idea

Normalize every source into a local skill directory before indexing it.

- Local folder: use it directly.
- GitHub URL: fetch into a workspace cache, then treat it as a local folder.
- Already-cloned repo: also treat it as a local folder.

That gives one code path for scanning, validation, and markdown link resolution.

For LLM navigation, I would also give every readable skill file a canonical URL:

- `skill://<resolved-name>/SKILL.md`
- `skill://<resolved-name>/references/...`
- `skill://<resolved-name>/assets/...`

The hook can map those URLs back to local files whether the original source was local, cloned, or fetched from GitHub.

Recommended cache shape:

```txt
.fragola/skills-cache/<owner>/<repo>/<ref>/...
```

## Suggested model

```ts
type SkillSource =
  | { kind: "fs"; path: string }
  | { kind: "github"; repoUrl: string; ref?: string; subdir?: string };

type Skill = {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string;
  metadata: Record<string, string>;
};

type SkillLink = {
  label: string;
  url: string;
  localPath: string;
};

type ResolvedSkill = {
  resolvedName: string;
  skill: Skill;
  localRoot: string;
  skillFile: string;
  body: string;
  references: string[];
  assets: string[];
  links: SkillLink[];
  source: { kind: "fs" | "github"; origin: string };
};

type ActivatedSkillEntry = {
  resolvedName: string;
  skillName: string;
  scope: `skill:${string}`;
  activatedAt: string;
};

type SkillsStoreValue = {
  activatedSkills: Record<string, ActivatedSkillEntry>;
};
```

The useful split is: `Skill` is the pure Agent Skills spec object, while `ResolvedSkill` is the Fragola runtime view enriched with filesystem and link-resolution data.

`ResolvedSkill.resolvedName` is the unique runtime name used by the registry, tool calls, store keys, instruction scopes, and `skill://` URLs. It should start as `skill.name`, and if that name already exists it should become `name-${nanoid()}`.

Resolution flow:

1. Resolve a source to a local directory.
2. Detect one skill at the repo root or multiple skills in first-level child folders.
3. Parse metadata into a `Skill`.
4. Assign a unique `resolvedName`; if `skill.name` already exists, use `name-${nanoid()}`.
5. Load the full `SKILL.md` only when the skill is activated.
6. Load `references/` and `assets/` only on demand.

## Markdown navigation

Relative links are fine for humans, but not enough for an LLM by themselves. The hook should resolve them into stable skill URLs and make those URLs readable through a tool.

Recommended behavior:

1. Parse markdown links in `SKILL.md`.
2. Resolve each relative target against the skill root.
3. Allow only files inside `SKILL.md`, `references/`, and `assets/`.
4. Rewrite links to canonical URLs like `skill://code-review-V1StGXR8/references/REFERENCE.md`.
5. Expose a `read_skill_file` tool that accepts an array of those file URLs.
6. Return the file contents concatenated with explicit wrappers, for example:

```txt
-- begin: skill://code-review-V1StGXR8/references/REFERENCE.md --
...content...
-- end: skill://code-review-V1StGXR8/references/REFERENCE.md --
```

This is also the answer to the cloned-repo question: once a repo becomes a local directory, it is navigated exactly like any other filesystem skill because the LLM only sees the canonical `skill://...` URLs built from `resolvedName`.

For `assets/`, text files can be read directly. Binary files should return metadata + local path, not be inlined.

## Store-backed activation

I would use a dedicated namespaced store to track active skill scopes:

```ts
import { createStore } from "@fragola-ai/agent/store";

function createSkillsStore() {
  const store = createStore<SkillsStoreValue>({ activatedSkills: {} }, "skills");

  return {
    store,
    activate(resolved: ResolvedSkill) {
      store.update((prev) => ({
        ...prev,
        activatedSkills: {
          ...prev.activatedSkills,
          [resolved.resolvedName]: {
            resolvedName: resolved.resolvedName,
            skillName: resolved.skill.name,
            scope: `skill:${resolved.resolvedName}`,
            activatedAt: new Date().toISOString(),
          },
        },
      }));
    },
    deactivate(resolvedName: string) {
      store.update((prev) => {
        const activatedSkills = { ...prev.activatedSkills };
        delete activatedSkills[resolvedName];
        return { ...prev, activatedSkills };
      });
    },
  };
}
```

The store helper should own activation state, and the hook/tool layer should pair it with `agent.context.setInstructions(scope)` and `agent.context.removeInstructions(scope)`. Deactivation should use the runtime `resolvedName`, because that is the stable key exposed by the registry and tools.

## Initial system prompt

There should be a small startup prompt telling the model that skills exist and that it can use the skill tools together with its normal tools:

```txt
You can use installed skills when they help with the task.

- Use `list_skills` to see available skills and when to use them.
- Use `activate_skill` with the exact runtime name returned by `list_skills` when a listed skill is relevant.
- When an activated skill contains links like `skill://...`, use `read_skill_file` to read one or more linked files.
- Use your existing tools together with skill guidance.
- Keep only relevant skills active; use `deactivate_skill` when a skill is no longer needed.
```

## Fragola hook sketch

```ts
import { tool } from "@fragola-ai/agent";
import type { FragolaHook } from "@fragola-ai/agent/hook";
import z from "zod";

export const skills = (options: { sources: SkillSource[] }): FragolaHook => {
  return async (agent) => {
    const registry = await loadSkills(options.sources);
    const skillsStore = createSkillsStore();

    agent.context.addStore(skillsStore.store);
    agent.context.setInstructions(renderSkillsSystemPrompt(), "skills:system");
    agent.context.setInstructions(renderSkillsCatalog(registry.skills), "skills:catalog");

    const listSkills = tool({
      name: "list_skills",
      description: "List available skills, their runtime names, and when to use them",
      schema: z.object({}),
      handler: async () => registry.skills.map(({ resolvedName, skill }) => ({
        name: resolvedName,
        skillName: skill.name,
        description: skill.description,
      })),
    });

    const activateSkill = tool({
      name: "activate_skill",
      description: "Load a skill's SKILL.md into agent instructions and track it in the store",
      schema: z.object({ name: z.string() }),
      handler: async ({ name }) => {
        const skill = await registry.getByName(name);
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
        skillsStore.deactivate(name);
        agent.context.removeInstructions(`skill:${name}`);
        return `Skill '${name}' deactivated`;
      },
    });

    const readSkillFile = tool({
      name: "read_skill_file",
      description: "Read one or more skill files referenced by skill:// URLs",
      schema: z.object({ files: z.array(z.string()).min(1).max(10) }),
      handler: async ({ files }) => readAllowedSkillFiles(registry, files),
    });

    agent.context.updateTools((prev) => [
      ...prev,
      listSkills,
      activateSkill,
      deactivateSkill,
      readSkillFile,
    ]);
  };
};
```

## Suggested hook layout

```txt
hook.presets/skills/
├── src/index.ts              # public hook factory; wires prompt, store, tools, and disposal
├── src/types.ts              # Skill spec types, ResolvedSkill runtime type, link/source/store state types
├── src/store.ts              # createSkillsStore(), activate(), deactivate(resolvedName), active-skill helpers
├── src/prompt.ts             # startup system prompt, catalog rendering, activated skill rendering
├── src/registry.ts           # in-memory registry with conflict-safe resolvedName assignment, getByName(), list(), and URL resolution
├── src/resolver.ts           # resolves fs/github sources into local directories and cache paths
├── src/scan.ts               # finds skill roots and parses SKILL.md frontmatter/body
├── src/links.ts              # extracts markdown links and rewrites them to skill://<resolvedName>/... URLs
├── src/tools.ts              # list_skills, activate_skill, deactivate_skill, read_skill_file using runtime names
├── src/readFiles.ts          # safe batched file reads and -- begin: ... -- / -- end: ... -- formatting
└── src/github.ts             # GitHub fetch/clone logic that materializes remote skills locally
```

## Practical defaults

- Keep the startup catalog small: `name`, `description`, maybe `compatibility`.
- Validate `name`, `description`, parent directory match, and link targets.
- If a skill name is already taken, keep the spec name unchanged and assign the runtime name `name-${nanoid()}`.
- Prefer canonical `skill://...` URLs over raw local paths in rendered prompts.
- Add a namespaced `skills` store and use it to track `activatedSkills`.
- Respect `allowed-tools` as advisory metadata first, then optionally use it later to gate tools.
- Ignore `scripts/` completely in the first implementation.

## Recommendation

The cleanest design is to make remote skills boring:

- fetch GitHub skills into a local cache
- index them exactly like local skills
- resolve markdown links the same way for every source type

That keeps the hook simple, makes prompts predictable, and gives the LLM one navigation model instead of two.