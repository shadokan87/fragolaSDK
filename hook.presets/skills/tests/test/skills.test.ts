import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  callTool,
  createAgentWithSkills,
  createSkillSourceFixture,
  disposeSkillsHook,
  ensureClonedRepo,
  unwrapSingleFileBlock,
} from "./helpers";

const PROBABL_SKILLS_REPO = "https://github.com/probabl-ai/skills.git";
const CLAUDE_SKILLS_ENGINEERING_URL = "https://github.com/alirezarezvani/claude-skills/tree/main/engineering-team/skills";
const REMOTE_TEST_TIMEOUT = 120_000;

const trackedAgents = new Set<Awaited<ReturnType<typeof createAgentWithSkills>>>();

function trackAgent(agent: Awaited<ReturnType<typeof createAgentWithSkills>>) {
  trackedAgents.add(agent);
  return agent;
}

afterEach(async () => {
  await Promise.all([...trackedAgents].map(async (agent) => {
    trackedAgents.delete(agent);
    await disposeSkillsHook(agent);
  }));
});

describe("hook-skills", () => {
  it("installs the hook, activates a skill, rewrites links, and gates file reads", async () => {
    const sourceDir = await createSkillSourceFixture([
      {
        name: "linked-skill",
        description: "Skill with a linked guide",
        body: "See [guide](references/guide.md) for the full workflow.",
        references: {
          "guide.md": "# Guide\n\nFollow the linked guide.",
        },
      },
    ]);

    const agent = trackAgent(await createAgentWithSkills({
      sources: [{ kind: "fs", path: sourceDir }],
    }, "linked-skill-agent"));

    expect(agent.context.getStore("skills")).toBeDefined();
    expect(agent.context.getInstructions("skills:system")).toContain("list_skills");
    expect(agent.context.getInstructions("skills:catalog")).toContain('runtime-name="linked-skill"');

    const listed = await callTool(agent, "list_skills", {}) as Array<{ name: string; skillName: string; active: boolean }>;
    expect(listed).toEqual([
      expect.objectContaining({
        name: "linked-skill",
        skillName: "linked-skill",
        active: false,
      }),
    ]);

    await expect(callTool(agent, "read_skill_file", {
      files: ["skill://linked-skill/SKILL.md"],
    })).rejects.toThrow("Skill 'linked-skill' is not active.");

    await expect(callTool(agent, "activate_skill", { name: "linked-skill" })).resolves.toContain("activated");

    const store = agent.context.getStore<{ activatedSkills: Record<string, { resolvedName: string }> }>("skills");
    expect(store?.value.activatedSkills["linked-skill"]?.resolvedName).toBe("linked-skill");

    const activeInstructions = agent.context.getInstructions("skill:linked-skill");
    expect(activeInstructions).toContain("linked-files:");
    expect(activeInstructions).toContain("skill://linked-skill/references/guide.md");

    const content = await callTool(agent, "read_skill_file", {
      files: [
        "skill://linked-skill/SKILL.md",
        "skill://linked-skill/references/guide.md",
      ],
    }) as string;

    expect(content).toContain("-- begin: skill://linked-skill/SKILL.md --");
    expect(content).toContain("-- begin: skill://linked-skill/references/guide.md --");
    expect(content).toContain("Follow the linked guide.");

    await expect(callTool(agent, "deactivate_skill", { name: "linked-skill" })).resolves.toContain("deactivated");
    expect(agent.context.getInstructions("skill:linked-skill")).toBeUndefined();
    expect(agent.context.getStore<{ activatedSkills: Record<string, unknown> }>("skills")?.value.activatedSkills).toEqual({});

    await expect(callTool(agent, "read_skill_file", {
      files: ["skill://linked-skill/SKILL.md"],
    })).rejects.toThrow("Skill 'linked-skill' is not active.");
  });

  it("assigns a nanoid suffix when two skills share the same spec name", async () => {
    const firstSource = await createSkillSourceFixture([
      { name: "duplicate-skill", description: "first duplicate", body: "First" },
    ]);
    const secondSource = await createSkillSourceFixture([
      { name: "duplicate-skill", description: "second duplicate", body: "Second" },
    ]);

    const agent = trackAgent(await createAgentWithSkills({
      sources: [
        { kind: "fs", path: firstSource },
        { kind: "fs", path: secondSource },
      ],
    }, "duplicate-skill-agent"));

    const listed = await callTool(agent, "list_skills", {}) as Array<{ name: string; skillName: string }>;
    const runtimeNames = listed.map((entry) => entry.name).sort();

    expect(listed).toHaveLength(2);
    expect(listed.every((entry) => entry.skillName === "duplicate-skill")).toBe(true);
    expect(runtimeNames).toContain("duplicate-skill");
    expect(runtimeNames.some((name) => /^duplicate-skill-/.test(name))).toBe(true);
  });

  it("loads the probabl-ai skills repo from fs and github with matching catalogs", async () => {
    const localRepoPath = await ensureClonedRepo(PROBABL_SKILLS_REPO, "probabl-ai-skills");

    const localAgent = trackAgent(await createAgentWithSkills({
      sources: [{ kind: "fs", path: path.join(localRepoPath, "skills") }],
      cacheDir: path.join(localRepoPath, ".fragola-cache-local"),
    }, "probabl-local-agent"));

    const githubAgent = trackAgent(await createAgentWithSkills({
      sources: [{ kind: "github", repoUrl: PROBABL_SKILLS_REPO, subdir: "skills" }],
      cacheDir: path.join(localRepoPath, ".fragola-cache-github"),
    }, "probabl-github-agent"));

    const localList = await callTool(localAgent, "list_skills", {}) as Array<{ name: string; skillName: string }>;
    const githubList = await callTool(githubAgent, "list_skills", {}) as Array<{ name: string; skillName: string }>;

    const localSkillNames = localList.map((entry) => entry.skillName).sort();
    const githubSkillNames = githubList.map((entry) => entry.skillName).sort();

    expect(localSkillNames.length).toBeGreaterThan(10);
    expect(githubSkillNames).toEqual(localSkillNames);

    const targetSkillName = localSkillNames.includes("python-api") ? "python-api" : localSkillNames[0];
    const localSkill = localList.find((entry) => entry.skillName === targetSkillName)!;
    const githubSkill = githubList.find((entry) => entry.skillName === targetSkillName)!;

    await callTool(localAgent, "activate_skill", { name: localSkill.name });
    await callTool(githubAgent, "activate_skill", { name: githubSkill.name });

    const localContent = await callTool(localAgent, "read_skill_file", {
      files: [`skill://${localSkill.name}/SKILL.md`],
    }) as string;
    const githubContent = await callTool(githubAgent, "read_skill_file", {
      files: [`skill://${githubSkill.name}/SKILL.md`],
    }) as string;

    expect(unwrapSingleFileBlock(localContent)).toEqual(unwrapSingleFileBlock(githubContent));
  }, REMOTE_TEST_TIMEOUT);

  it("loads a sampled set of skills from the claude-skills engineering tree url", async () => {
    const agent = trackAgent(await createAgentWithSkills({
      sources: [{ kind: "github", repoUrl: CLAUDE_SKILLS_ENGINEERING_URL }],
      cacheDir: path.join(process.cwd(), ".claude-skills-test-cache"),
    }, "claude-skills-agent"));

    const listed = await callTool(agent, "list_skills", {}) as Array<{
      name: string;
      skillName: string;
      description: string;
      source: string;
    }>;

    expect(listed.length).toBeGreaterThanOrEqual(5);

    for (const entry of listed.slice(0, 5)) {
      expect(entry.name).toBeTruthy();
      expect(entry.skillName).toBeTruthy();
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.source).toContain("claude-skills");
    }

    const sampleSkill = listed.find((entry) => entry.skillName === "senior-frontend") ?? listed[0];
    await expect(callTool(agent, "activate_skill", { name: sampleSkill.name })).resolves.toContain("activated");

    const content = await callTool(agent, "read_skill_file", {
      files: [`skill://${sampleSkill.name}/SKILL.md`],
    }) as string;

    expect(content).toContain(`-- begin: skill://${sampleSkill.name}/SKILL.md --`);
  }, REMOTE_TEST_TIMEOUT);
});
