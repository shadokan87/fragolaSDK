# @fragola-ai/hook-skills

`@fragola-ai/hook-skills` loads [Agent Skills](https://agentskills.io/specification) into a Fragola agent from local folders or GitHub repositories.

The hook adds a small system prompt, a namespaced `skills` store that tracks active skills, and four tools:

- `list_skills`
- `activate_skill`
- `deactivate_skill`
- `read_skill_file`

## What It Supports

- local filesystem skill sources
- GitHub repository URLs
- GitHub `tree/<ref>/...` URLs
- relative markdown links rewritten to `skill://<resolved-name>/...`
- on-demand reads for `SKILL.md`, `references/`, and `assets/`

Current limitations:

- `scripts/` are indexed but not executed by the hook
- arbitrary extra directories are ignored
- GitHub sources are materialized locally before scanning

## Install

```bash
bun add @fragola-ai/hook-skills
```

## Usage

```ts
import { Fragola } from "@fragola-ai/agent";
import skills from "@fragola-ai/hook-skills";

const fragola = new Fragola({
	apiKey: process.env.OPENAI_API_KEY!,
	model: "gpt-5.4",
});

const agent = fragola.agent({
	name: "assistant",
	description: "Assistant with agent-skills support",
	instructions: "You are a helpful assistant.",
}).use(skills({
	sources: [
		{ kind: "fs", path: "/absolute/path/to/my-skills" },
		{ kind: "github", repoUrl: "https://github.com/probabl-ai/skills.git", subdir: "skills" },
		{ kind: "github", repoUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/engineering-team/skills" },
	],
}));
```

## Source Formats

Filesystem source:

```ts
{ kind: "fs", path: "/absolute/path/to/skills-root" }
```

GitHub source:

```ts
{ kind: "github", repoUrl: "https://github.com/org/repo.git" }
{ kind: "github", repoUrl: "https://github.com/org/repo.git", subdir: "skills" }
{ kind: "github", repoUrl: "https://github.com/org/repo/tree/main/skills" }
{ kind: "github", repoUrl: "https://github.com/org/repo.git", ref: "main", subdir: "skills" }
```

## Runtime Behavior

- each skill keeps its spec-facing `skill.name`
- the hook assigns a unique runtime `resolvedName`
- if two skills share the same spec name, the second becomes `name-<nanoid>`
- `skill://` links and activation scopes use the runtime name

The hook stores activation state in the `skills` namespaced store:

```ts
const store = agent.context.getStore("skills");
console.log(store?.value.activatedSkills);
```

## Tool Behavior

`list_skills` returns the runtime name, original spec name, description, compatibility, active state, and source origin.

`activate_skill` loads the rendered skill instructions into a dedicated instruction scope.

`deactivate_skill` removes that instruction scope and clears the store entry.

`read_skill_file` only works for active skills and returns one or more files wrapped like this:

```txt
-- begin: skill://my-skill/SKILL.md --
...
-- end: skill://my-skill/SKILL.md --
```

## Development

Build:

```bash
bun run build
```

Typecheck / test package:

```bash
bun run test:build
```

The test suite lives in `hook.presets/skills/tests`.
