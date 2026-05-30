import type { FragolaHook } from "@fragola-ai/agent/hook";
import { createStore } from "@fragola-ai/agent/store";
import { nanoid } from "nanoid";
import { access, readFile as readFileFs } from 'fs/promises';
import { constants } from 'fs';

type maybePromise<T> = Promise<T> | T;

export interface SkillFrontMatter {
  name: string,
  description: string,
  license: string,
  "allowed-tools": string[],
  metadata: Record<string, string>
}

export interface Sandbox {
  readFile(path: string, encoding: BufferEncoding): Promise<string>,
}

type SkillBase = {
  id: string,
  source: SkillSource,
}

export type loadedSkill = SkillBase & {
  status: "loaded",
  frontMatter: SkillFrontMatter,
  body: string | undefined,
}

export type processingSkill = SkillBase & {
  status: "processing"
}

export type failedSkill = SkillBase & {
  status: "error",
  error?: unknown
}

export type Skill = processingSkill | loadedSkill | failedSkill;

export type FrontMatterParser = (raw: string) => SkillFrontMatter;

export type IdGenerator = (source: SkillSource) => string;

export type SkillSource = {
  kind?: "fs",
  path: string
}

export const defaultFrontMatterParser: FrontMatterParser = (raw) => {
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
  frontMatterParser?: FrontMatterParser,
  enforceFrontMatterParsing?: boolean,
  sandbox: Sandbox,
  debug?: boolean;
};

export type SkillsStore = {
  skills: Map<SkillBase["id"], Skill>,
}

// export const skillsStore = createStore<SkillsStore>({
//   skills: []
// })


export const skills = (options: TemplateOptions): FragolaHook => {
  return async (agent) => {
    if (options?.debug) {
      console.log("[hook-skills] installed");
    }
    const { sources } = options;
    const getId: IdGenerator = options.idGenerator ?? defaultIdGenerator;

    const store = createStore<SkillsStore>({
      skills: new Map()
    }, options.storeName ?? "skills");

    agent.context.addStore(store);

    for (const source of sources) {
      let current: processingSkill = {
        id: getId(source),
        source,
        status: "processing",
      }

      store.update((prev) => {
        prev.skills.set(current.id, current);
        return prev;
      });
      // Retrieving content
      let content: string;
      switch (source.kind) {
        case "fs": {
          try {
            content = await options.sandbox.readFile(source.path, "utf-8");
          } catch (e) {
            store.update((prev) => {
              prev.skills.set(current.id, {
                id: current.id,
                source: current.source,
                status: "error",
                error: e
              })
              return prev;
            });
          }
          break;
        }
        default: {
          throw new Error(`Unknown skill source '${source.kind}'`)
        }
      }
      
      // Parsing frontMatter
    }

    // cleanup
    return () => {

    }
  };
};

export default skills;