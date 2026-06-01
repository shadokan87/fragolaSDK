import type { FragolaHook } from "@fragola-ai/agent/hook";
import { createStore } from "@fragola-ai/agent/store";
import { tool } from "@fragola-ai/agent";
import { nanoid } from "nanoid";
import { access, readFile as readFileFs } from 'fs/promises';
import { constants } from 'fs';
import { join } from "path";
import { z } from "zod";
import YAML from "yaml";
import Prompt from "@fragola-ai/prompt";

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



export interface Sandbox {
  readFile(path: string, encoding: BufferEncoding): Promise<string>,
}

type SkillBase = {
  id: string,
  source: SkillSource,
}

export type loadedSkill = SkillBase & {
  status: "loaded",
  body: string | undefined,
  exclude?: boolean,
} & SkillFrontmatter;

export type processingSkill = SkillBase & {
  status: "processing"
}

export type failedSkill = SkillBase & {
  status: "error",
  isZodError?: boolean,
  error?: unknown
}

export type Skill = processingSkill | loadedSkill | failedSkill;

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

export const defaultSandbox: Sandbox = {
  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    await access(path, constants.R_OK);
    return await readFileFs(path, { encoding });
  }
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
  ids: SkillId[],
  excludeSkills: (ids: SkillId[]) => void,
  unexcludeSkills: (ids: SkillId[]) => void,
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
    When needed, call the activate_skill tool with the skill id.
  Do not activate multiple skills unless the task clearly requires it.
  ## Skills catalog
  {{ skills }}
  ## Loaded skills
  {{ loaded_skills }}
  `;

    const prompt = new Prompt(template, {
      skills: "No skills are available"
    });

    setInstructions(prompt.value);

    const store = createStore<SkillsStore>({
      skills: {},
      ids: [],
      excludeSkills: () => { },
      unexcludeSkills: () => { },
      addSources: async () => {}
    }, storeName);

    const buildSkillsVariable = () => {
      let res: string = "No skills are available";
      for (const id of store.value.ids) {
        const skill = store.value.skills[id];
        if (skill.status != "loaded" || skill.exclude)
          continue;
        res += `\n${{
          id: skill.id,
          name: skill.name,
          description: skill.description
        }
          }`
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
        skills: buildSkillsVariable()
      });
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
              content = await sandbox.readFile(skillPath, "utf-8");
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

        let loaded: loadedSkill = {
          ...current,
          ...yamlParsed,
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
        excludeSkills: (ids) => {
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
        unexcludeSkills: (ids) => {
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
        addSources: async (sources) => await processSources(sources)
      }
    });
  
    agent.context.addStore(store);
    agent.context.updateTools((prev) => {
      return [...prev,
        tool({
          name: "activate_skill",
          description: "load a skill using its id",
          //@ts-expect-error
          schema: z.object({
            id: z.string().describe("the id of the skill to load")
          }),
          handler: () => {

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