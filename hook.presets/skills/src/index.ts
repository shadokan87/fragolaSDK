import type { FragolaHook } from "@fragola-ai/agent/hook";
import { createStore } from "@fragola-ai/agent/store";
import type { Store } from "@fragola-ai/agent/store";
import { tool } from "@fragola-ai/agent";
import { nanoid } from "nanoid";
import { access, readFile as readFileFs } from 'fs/promises';
import { constants } from 'fs';
import { join } from "path";
import { execFile } from 'child_process';
import { promisify } from 'util';
import { z } from "zod";
import YAML from "yaml";
import { posix } from 'path';
import { Prompt } from "@fragola-ai/prompt";

const execFileAsync = promisify(execFile);

type maybePromise<T> = Promise<T> | T;

export type SkillFrontmatter = {
  name: string,
  description: string,
  license?: string,
  compatibility?: string,
  "allowed-tools"?: string,
  metadata?: Record<string, string>,
} & Record<string, unknown>;

const skillFrontmatterNamePattern = /^[\p{L}\p{N}-]+$/u;
const skillFrontmatterAllowedToolsPattern = /^\S+(?: \S+)*$/;

export const SkillFrontmatterSchema: z.ZodType<SkillFrontmatter> = z.object({
  name: z.string(),
  description: z.string(),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  "allowed-tools": z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
}).catchall(z.unknown());

export const SkillFrontmatterGrammarSchema = z.object({
  name: z.string()
    .trim()
    .min(1)
    .max(64)
    .refine((value) => value.normalize("NFKC") === value.normalize("NFKC").toLowerCase(), {
      message: "Skill name must be lowercase",
    })
    .refine((value) => !value.startsWith("-") && !value.endsWith("-"), {
      message: "Skill name cannot start or end with a hyphen",
    })
    .refine((value) => !value.includes("--"), {
      message: "Skill name cannot contain consecutive hyphens",
    })
    .refine((value) => skillFrontmatterNamePattern.test(value.normalize("NFKC")), {
      message: "Skill name may only contain letters, digits, and hyphens",
    }),
  description: z.string().trim().min(1).max(1024),
  license: z.string().trim().min(1).optional(),
  compatibility: z.string().trim().min(1).max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  "allowed-tools": z.string().min(1).regex(skillFrontmatterAllowedToolsPattern).optional(),
}).catchall(z.unknown());


export type ExecuteScriptResult = {
  exitCode: number,
  stdout: string,
  stderr: string
}

export interface Sandbox {
  readFile(path: string, encoding: BufferEncoding, store: Store<SkillsStore>): Promise<string>,
  executeScript(skillId: SkillId, path: string, args: string[], store: Store<SkillsStore>): Promise<ExecuteScriptResult>,
  readReference(skillId: SkillId, path: string, store: Store<SkillsStore>): Promise<string>
}

type SkillBase = {
  id: string,
  source: SkillSource,
}

export type LoadedSkill = SkillBase & {
  status: "loaded",
  body: string | undefined,
  exclude: boolean,
} & SkillFrontmatter;

export type processingSkill = SkillBase & {
  status: "processing"
}

export type failedSkill = SkillBase & {
  status: "error",
  isZodError?: boolean,
  error?: unknown
}

export type Skill = processingSkill | LoadedSkill | failedSkill;

export type FrontmatterParser = (raw: string) => SkillFrontmatter;

export type IdGenerator = (source: SkillSource) => string;

export type ExcludeSkillCallback = (ids: Skill["id"][]) => void;

export type SkillSource = {
  kind?: "fs",
  path: string
}

export const defaultFrontmatterParser: FrontmatterParser = (raw) => {
  return {} as any;
}

export class SandBoxOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandBoxOperationError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SandBoxOperationError);
    }
  }
}

export const defaultSandbox: Sandbox = {
  async readFile(path: string, encoding: BufferEncoding, store: Store<SkillsStore>): Promise<string> {
    void store;
    await access(path, constants.R_OK);
    return await readFileFs(path, { encoding });
  },
  async executeScript(skillId, path, args, store: Store<SkillsStore>): Promise<{
    exitCode: number,
    stdout: string,
    stderr: string
  }> {
    const skill = store.value.get(skillId);
    if (!skill)
      throw new SandBoxOperationError(`Skill does not exist: '${skillId}'`);
    const normalized = posix.normalize(path);

    if (posix.isAbsolute(normalized))
      throw new SandBoxOperationError(`Absolute paths are not allowed: '${path}'`);

    const parts = normalized.split('/');
    if (parts[0] != "scripts") {
      throw new SandBoxOperationError(`Invalid script path: '${path}'. Scripts must be located in the 'scripts' directory at the root of the skill.`);
    }
    const scriptPath = posix.join(skill.source.path, normalized);
    try {
      await access(scriptPath, constants.X_OK);
    } catch (e) {
      void e;
      throw new SandBoxOperationError(`Script path valid but does not exist or execution is unauthorized: ${normalized}`);
    }
  
    try {
      const { stdout, stderr } = await execFileAsync(path, args, { cwd: skill.source.path });
      return { exitCode: 0, stdout, stderr };
    } catch (e: any) {
      if (e.code !== undefined && typeof e.code === 'number') {
        return {
          exitCode: e.code,
          stdout: e.stdout || "",
          stderr: e.stderr || ""
        };
      }
      throw e;
    }
  },
  async readReference(skillId, path, store: Store<SkillsStore>): Promise<string> {
    return "";
  },
}

export const defaultIdGenerator: IdGenerator = () => {
  return nanoid();
}

export type TemplateOptions = {
  sources: SkillSource[],
  /* Customize Skill.id */
  idGenerator?: IdGenerator;
  /* Define your own parser for the frontmatter */
  frontmatterParser?: FrontmatterParser,
  enforceFrontmatterGrammar?: boolean,
  throwReadErrors?: boolean,
  throwParsingErrors?: boolean,
  sandbox?: Sandbox,
  /* The name of the store, default to 'skills' */
  storeName?: string;
  /* The name of the instructions scope, default to 'skills' */
  instructionsScope?: string;
  debug?: boolean;
};

export type SkillId = Skill["id"];

export type SkillsStore = {
  skills: Readonly<Record<Skill["id"], Skill>>,
  ids: Readonly<SkillId>[],
  activated: Readonly<SkillId>[],
  get: (id: SkillId) => Skill | undefined,
  deactivate: (ids: SkillId[]) => SkillId[],
  activate: (ids: SkillId[]) => SkillId[],
  exclude: (ids: SkillId[]) => void,
  unexclude: (ids: SkillId[]) => void,
  addSources: (sources: SkillSource[]) => Promise<void>
}

export const skills = (options: TemplateOptions): FragolaHook => {
  return async (agent) => {
    if (options?.debug) {
      console.log("[hook-skills] installed");
    }
    const getId: IdGenerator = options.idGenerator ?? defaultIdGenerator;
    const sandbox = options.sandbox ?? defaultSandbox;
    const storeName = options.storeName ?? "skills";
    const instructionsScope = options.instructionsScope ?? "skills";

    const setInstructions = (instructions: string) => agent.context.setInstructions(instructions, instructionsScope);
    const template =
      `# Skills
Skills are reusable task-specific instruction bundles.
Use them only when relevant to the task.
Review the available skills in the catalog below and choose the best match by name and description.
When needed, call the activate_skill tool with the skill id(s).
## Activation guidelines
When calling \`activate_skill\`, follow the tool's schema exactly: provide a single object with an \`ids\` field whose value is an array of skill id strings (for example: \`{ ids: [\\"skill-id-1\\", \\\"skill-id-2\\\"] }\`).
Only pass skill \`id\` values (not names or full skill objects). The tool will ignore or reject inputs that don't match the schema.
Do not activate multiple skills unless the task clearly requires it.
## Skills related dialogue guidelines
- **Do not expose internal IDs:** Never share a skill's \`id\` with the user; IDs are for internal use only.
- **Keep user-facing language natural:** Describe what a skill does and the expected outcome rather than mentioning internal tool names or implementation details.
- **Ask for confirmation when appropriate:** If activating a skill may change the task scope, briefly explain the action and ask the user for confirmation before proceeding.
- **Report results clearly:** After a skill runs, summarize the result in plain language and surface any important details or next steps to the user.
- **Handle errors gracefully:** If a skill fails to activate or run, apologize succinctly, explain the problem in user-friendly terms, and offer alternatives.
- **Avoid internal terminology:** Do not mention internal keywords, tool names etc; keep explanations high-level and helpful.
## Script execution guidelines
When calling \`execute_script\`, follow these guidelines:
- **Paths must be relative:** All script paths must be relative to the skill root and start with \`scripts/\`.
- **Nested folders are allowed:** You can use nested paths like \`scripts/terminal/my-script.sh\`.
- **Include file extensions:** The path must include the full filename with its extension (e.g., \`scripts/run.sh\`, \`scripts/utils/check.py\`).
- **Use arguments when needed:** Provide necessary arguments in the \`args\` array. If unsure, try passing \`--help\` as an argument first.
## Skills catalog
{{ skills }}
## Activated skills
{{ activated_skills }}
  `;

    type PromptVariables = {
      skills: string,
      activated_skills: string
    }

    const prompt = new Prompt(template, {
      skills: "No skills are available",
      activated_skills: "No skills activated"
    } as PromptVariables);

    setInstructions(prompt.value);

    //@ts-expect-error - utility functions will be added to the store below
    const store = createStore<SkillsStore>({
      skills: {},
      ids: [],
      activated: [],
    }, storeName);

    const buildSkillsVariable = () => {
      let res: string = "No skills are available";
      for (const id of store.value.ids) {
        const skill = store.value.skills[id];
        if (skill.status != "loaded" || skill.exclude)
          continue;
        res +=
          `id: ${skill.id}
name: ${skill.name}
description: ${skill.description}

`
      }
      return res.trim();
    }

    const buildActivatedSkillsVariable = () => {
      let res: string = "No skills activated";
      for (const [index, id] of store.value.activated.entries()) {
        const skill = store.value.skills[id] as LoadedSkill;
        res +=
          `
---
id: ${skill.id}
name: ${skill.name}
---
${skill.body}
`;
        if (index != store.value.activated.length - 1) {
          res += "\n"
        }
      }
      return res;
    }

    const addSkill = (skill: Skill) => {
      store.update((prev) => {
        prev.ids = [...prev.ids, skill.id];

        //@ts-expect-error
        prev.skills[skill.id] = skill;
        return prev;
      });
      prompt.setVariables({
        ...prompt.variables,
        skills: buildSkillsVariable()
      } as PromptVariables);
      setInstructions(prompt.value);
    }

    const setCurrentError = (current: processingSkill, error: unknown, isZodError: boolean = false) => {
      addSkill({
        id: current.id,
        source: current.source,
        status: "error",
        isZodError,
        error
      }
      );
    }

    const processSources = async (sources: SkillSource[]) => {
      for (const source of sources) {
        if (!source.kind)
          source["kind"] = "fs"

        let current: processingSkill = {
          id: getId(source),
          source,
          status: "processing",
        }
        const skillPath = join(source.path, "SKILL.md");

        store.update((prev) => {
          // prev.skills.set(current.id, current);
          return prev;
        });
        // Retrieving content
        let content: string | undefined;
        switch (source.kind) {
          case "fs": {
            try {
              content = await sandbox.readFile(skillPath, "utf-8", store);
            } catch (e) {
              setCurrentError(current, e);
              if (options.throwReadErrors) {
                throw e;
              }
            }
            break;
          }
          default:
            throw new Error(`Unknown skill source '${source.kind}'`)
        }
        if (!content) {
          setCurrentError(current, new Error("Empty content"));
          continue;
        }
        // Extracting frontmatter
        const frontmatterStart = content.indexOf("---");
        if (frontmatterStart != 0) {
          const error = new Error("[frontmatter parsing error]: Failed to detect the start of the frontmatter in your SKILL.md file. The frontmatter must start at line 1 of the document");
          setCurrentError(current, error);
          if (options.throwParsingErrors)
            throw error;
          continue;
        }

        const frontMatterEnd = content.indexOf("---", 1);
        if (frontMatterEnd == -1) {
          const error = new Error("[frontmatter parsing error]: Failed to detect the end of the frontmatter in your SKILL.md file.");
          setCurrentError(current, error);
          if (options.throwParsingErrors)
            throw error;
          continue;
        }

        // Parsing frontmatter with yaml and validating with zod
        const frontMatterRaw = content.slice(frontmatterStart + 3, frontMatterEnd).trim();
        let yamlParsed: any = {};
        try {
          yamlParsed = YAML.parse(frontMatterRaw);
          const zodParsed = options.enforceFrontmatterGrammar ? SkillFrontmatterGrammarSchema.safeParse(yamlParsed) : SkillFrontmatterSchema.safeParse(yamlParsed);
          if (zodParsed.error) {
            setCurrentError(current, zodParsed.error, true);
            continue;
          }
        } catch (error) {
          setCurrentError
          if (options.throwParsingErrors)
            throw error;
          continue;
        }

        let loaded: LoadedSkill = {
          ...current,
          ...yamlParsed,
          exclude: false,
          status: "loaded",
          body: content.slice(frontMatterEnd + 3).trim()
        }
        addSkill(loaded);
      }
    }

    // Here we add the utility functions in the store
    store.update((prev) => {
      return {
        ...prev,
        get: (id) => {
          return store.value.skills[id];
        },
        deactivate: (ids) => {
          const valid = ids.filter((id) => {
            const skill = store.value.skills[id];
            if (!skill)
              return false;
            return store.value.activated.includes(id);
          });
          if (valid.length)
            store.update((_prev) => ({
              ..._prev,
              activated: _prev.activated.filter(id => valid.includes(id))
            }));
          return valid;
        },
        activate: (ids) => {
          const valid = ids.filter((id) => {
            const skill = store.value.skills[id];
            if (!skill)
              return false;
            return !store.value.activated.includes(id);
          });
          if (valid.length)
            store.update((_prev) => ({
              ..._prev,
              activated: [..._prev.activated, ...valid]
            }));
          prompt.setVariables({
            ...prompt.variables,
            activated_skills: buildActivatedSkillsVariable()
          } as PromptVariables);

          return ids;
        },
        exclude: (ids) => {
          let skills: Record<SkillId, Skill> = store.value.skills;
          let shouldRebuildPrompt = false;
          for (const id of ids) {
            if (skills[id] && skills[id].status == "loaded" && !skills[id].exclude) {
              skills[id].exclude = true;
              shouldRebuildPrompt = true;
            }
          }
          if (shouldRebuildPrompt) {
            buildSkillsVariable();
            setInstructions(prompt.value);
          }
        },
        unexclude: (ids) => {
          // Same code as exclude but the conditions are reversed. A bit of code duplication doesn't hurt
          let skills: Record<SkillId, Skill> = store.value.skills;
          let shouldRebuildPrompt = false;
          for (const id of ids) {
            if (skills[id] && skills[id].status == "loaded" && skills[id].exclude) {
              skills[id].exclude = false;
              shouldRebuildPrompt = true;
            }
          }
          if (shouldRebuildPrompt) {
            buildSkillsVariable();
            setInstructions(prompt.value);
          }
        },
        addSources: async (sources) => await processSources(sources),
      }
    });

    agent.context.addStore(store);
    agent.context.updateTools((prev) => {
      return [...prev,
      tool({
        name: "activate_skill",
        description: "Load skills using their ids. Returns a list of skill id, some ids may be missing from the return value, it means the activation failed for these.",
        schema: z.object({
          ids: z.array(z.string()).describe("the id of the skill to load")
        }),
        handler: ({ ids }) => {
          return `Activated skills: ${store.value.activate(ids).join(",")}`
        }
      }),
      tool({
        name: "execute_script",
        description: "Will run a skill script and return the output.",
        schema: z.object({
          skillId: z.string().describe("the id of the script"),
          path: z.string().describe("the path of the script to execute"),
          args: z.array(z.string()).optional().describe("if any arguments are required for the proper execution, pass them here. you can pass the --help flag as argument if you are not certain of which arguments to use")
        }),
        handler: async (params) => {
          try {
            return await sandbox.executeScript(params.skillId, params.path, params.args ?? [], store);
          } catch(e) {
            if (e instanceof SandBoxOperationError) {
              return e.message;
            } else
              console.log(JSON.stringify(e, null, 2));
              process.exit(1);
              return "An internal error occured while running the script"
          }
        }
      })
      ]
    })
    await processSources(options.sources);
    // cleanup
    return () => {

    }
  };
};

export default skills;