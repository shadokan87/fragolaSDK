import type { FragolaHook } from "@fragola-ai/agent/hook";
import { createStore } from "@fragola-ai/agent/store";
import { nanoid } from "nanoid";
import { access, readFile as readFileFs } from 'fs/promises';
import { constants } from 'fs';
import { join } from "path";
import { z } from "zod";
import YAML from "yaml";

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
  frontmatter: SkillFrontmatter,
  body: string | undefined,
}

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
  /* The name of the store, default to 'skills' */
  storeName?: string;
  idGenerator?: IdGenerator;
  frontmatterParser?: FrontmatterParser,
  enforceFrontmatterGrammar?: boolean,
  throwReadErrors?: boolean,
  throwParsingErrors?: boolean,
  sandbox?: Sandbox,
  debug?: boolean;
};

export type SkillsStore = {
  skills: Map<SkillBase["id"], Skill>,
}

export const skills = (options: TemplateOptions): FragolaHook => {
  return async (agent) => {
    if (options?.debug) {
      console.log("[hook-skills] installed");
    }
    const { sources } = options;
    const getId: IdGenerator = options.idGenerator ?? defaultIdGenerator;
    const sandbox = options.sandbox ?? defaultSandbox;

    const store = createStore<SkillsStore>({
      skills: new Map()
    }, options.storeName ?? "skills");

    agent.context.addStore(store);

    const setCurrentError = (current: processingSkill, error: unknown, isZodError: boolean = false) => {
      store.update((prev) => {
        prev.skills.set(current.id, {
          id: current.id,
          source: current.source,
          status: "error",
          isZodError,
          error
        });
        console.log(JSON.stringify([...prev.skills], null, 2));
        return prev;
      });
    }

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
        prev.skills.set(current.id, current);
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
      // Parsing frontmatter
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
          continue ;
        }
      } catch (error) {
        setCurrentError
        if (options.throwParsingErrors)
          throw error;
        continue;
      }
      console.log("start", frontmatterStart);
      console.log("end", frontMatterEnd);
      console.log("raw", frontMatterRaw);
    }

    // cleanup
    return () => {

    }
  };
};

export default skills;