
import {tool} from "@fragola-ai/agent";
import {createStore} from "@fragola-ai/agent/store";
import type { FragolaHook } from "@fragola-ai/agent/hook";
import { glob } from "tinyglobby";
import z from "zod";

export type WorkspaceStore = {
    root: string
}

const workspaceInstructionName = "workspace";

const filePathSchema = z.object({
    path: z.string().min(1).describe("Path to the file, relative to the workspace root or an absolute path inside it")
});

const filePatchSchema = z.object({
    oldText: z.string().min(1).describe("Line selector from the read file tool, for example '12' or '12-14'") ,
    newText: z.string().describe("Replacement text without line number prefixes")
});

const refreshWorkspaceInstructions = async (context: { getStore: <T>(namespace?: string) => { value: T } | undefined; setInstructions: (instructions: string, scope?: string) => void; }) => {
    const store = context.getStore<WorkspaceStore>("workspace");
    if (!store) {
        throw new Error("Failed to retrieve workspace store");
    }

    type TreeNode = {
        name: string;
        type: "directory" | "file";
        children: Map<string, TreeNode>;
    };

    const rootName = store.value.root.split("/").filter(Boolean).at(-1) ?? store.value.root;
    const rootNode: TreeNode = {
        name: rootName,
        type: "directory",
        children: new Map()
    };

    const insertPath = (relativePath: string, type: "directory" | "file") => {
        const parts = relativePath.split("/").filter(Boolean);
        let current = rootNode;

        for (const [index, part] of parts.entries()) {
            const isLeaf = index === parts.length - 1;
            const existing = current.children.get(part);
            if (existing) {
                current = existing;
                continue;
            }

            const nextNode: TreeNode = {
                name: part,
                type: isLeaf ? type : "directory",
                children: new Map()
            };
            current.children.set(part, nextNode);
            current = nextNode;
        }
    };

    const renderTree = (node: TreeNode, depth = 0): string => {
        const prefix = "  ".repeat(depth);
        const label = `${prefix}${node.name}${node.type === "directory" ? "/" : ""}`;
        const children = [...node.children.values()]
            .sort((left, right) => {
                if (left.type !== right.type) {
                    return left.type === "directory" ? -1 : 1;
                }
                return left.name.localeCompare(right.name);
            })
            .map((child) => renderTree(child, depth + 1))
            .join("\n");
        return children ? `${label}\n${children}` : label;
    };

    const [directories, files] = await Promise.all([
        glob("**/*", { cwd: store.value.root, dot: true, onlyDirectories: true }),
        glob("**/*", { cwd: store.value.root, dot: true, onlyFiles: true })
    ]);

    directories.sort().forEach((path) => insertPath(path, "directory"));
    files.sort().forEach((path) => insertPath(path, "file"));

    context.setInstructions([
        `Workspace root: ${store.value.root}`,
        "Always use paths inside this root.",
        "Read file returns 1-based numbered lines in the form '<line>|<content>'.",
        "Update file patches must use oldText as a line number like '12' or an inclusive range like '12-14'.",
        "Current complete workspace file tree:",
        renderTree(rootNode)
    ].join("\n"), workspaceInstructionName);
};

const getWorkspaceFile = (context: { getStore: <T>(namespace?: string) => { value: T } | undefined }, inputPath: string) => {
    const store = context.getStore<WorkspaceStore>("workspace");
    if (!store) {
        throw new Error("Failed to retrieve workspace store");
    }

    const root = store.value.root.endsWith("/") ? store.value.root : `${store.value.root}/`;
    const rootUrl = Bun.pathToFileURL(root);
    const resolvedPath = Bun.fileURLToPath(new URL(inputPath, rootUrl));
    const normalizedRoot = Bun.fileURLToPath(rootUrl).replace(/\/$/, "");

    if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(`${normalizedRoot}/`)) {
        throw new Error(`Path '${inputPath}' is outside the workspace root '${normalizedRoot}'`);
    }

    return Bun.file(resolvedPath);
};

export const readFileByPathTool = tool({
    name: "read file",
    description: "read and return the content of a file in the workspace with 1-based line prefixes like '12|content'",
    schema: filePathSchema,
    handler: async (params, context ) => {
        const file = getWorkspaceFile(context, params.path);
        if (!await file.exists()) {
            throw new Error(`File '${params.path}' does not exist`);
        }

        const content = await file.text();
        if (content === "") {
            return "";
        }

        const lines = content.split("\n");
        if (content.endsWith("\n")) {
            lines.pop();
        }

        return lines.map((line, index) => `${index + 1}|${line}`).join("\n");
    }
});

export const createFileByPathTool = tool({
    name: "create file",
    description: "create a new file in the workspace",
    schema: filePathSchema.extend({
        content: z.string().describe("Content to write to the new file")
    }),
    handler: async (params, context) => {
        const file = getWorkspaceFile(context, params.path);
        if (await file.exists()) {
            throw new Error(`File '${params.path}' already exists`);
        }

        await Bun.write(file, params.content);
        await refreshWorkspaceInstructions(context);
        return `Created file '${params.path}'`;
    }
});

export const updateFileByPathTool = tool({
    name: "update file",
    description: "update a file by replacing the whole content or by applying patches whose oldText is a line number or inclusive line range from the read file tool",
    schema: filePathSchema.extend({
        content: z.string().optional().describe("Full replacement content for the file"),
        patches: z.array(filePatchSchema).min(1).optional().describe("Exact replacements whose oldText is a line number like '12' or a range like '12-14'")
    }).refine((value) => (value.content === undefined) !== (value.patches === undefined), {
        message: "Provide either content or patches"
    }),
    handler: async (params, context) => {
        const file = getWorkspaceFile(context, params.path);
        if (!await file.exists()) {
            throw new Error(`File '${params.path}' does not exist`);
        }

        if (params.content !== undefined) {
            await Bun.write(file, params.content);
            return `Updated file '${params.path}'`;
        }

        const currentContent = await file.text();
        const currentLines = currentContent === "" ? [] : currentContent.split("\n");
        const hadTrailingNewline = currentContent.endsWith("\n");
        if (hadTrailingNewline) {
            currentLines.pop();
        }

        const parsedPatches = (params.patches ?? []).map((patch, index) => {
            const match = /^(\d+)(?:-(\d+))?$/.exec(patch.oldText.trim());
            if (!match) {
                throw new Error(`Patch ${index + 1} in '${params.path}' must use a line number like '12' or a range like '12-14'`);
            }

            const startLine = Number(match[1]);
            const endLine = Number(match[2] ?? match[1]);
            if (startLine < 1 || endLine < startLine) {
                throw new Error(`Patch ${index + 1} in '${params.path}' uses an invalid line selector '${patch.oldText}'`);
            }

            if (endLine > currentLines.length) {
                throw new Error(`Patch ${index + 1} in '${params.path}' references lines outside the file: '${patch.oldText}'`);
            }

            return {
                startLine,
                deleteCount: endLine - startLine + 1,
                newLines: patch.newText === "" ? [] : patch.newText.split("\n")
            };
        }).sort((left, right) => right.startLine - left.startLine);

        for (const [index, patch] of parsedPatches.entries()) {
            currentLines.splice(patch.startLine - 1, patch.deleteCount, ...patch.newLines);
        }

        let nextContent = currentLines.join("\n");
        if (hadTrailingNewline && nextContent !== "") {
            nextContent += "\n";
        }

        await Bun.write(file, nextContent);
        return `Updated file '${params.path}' with ${params.patches?.length ?? 0} patch${params.patches?.length === 1 ? "" : "es"}`;
    }
});

export const deleteFileByPathTool = tool({
    name: "delete file",
    description: "delete a file from the workspace",
    schema: filePathSchema,
    handler: async (params, context) => {
        const file = getWorkspaceFile(context, params.path);
        if (!await file.exists()) {
            throw new Error(`File '${params.path}' does not exist`);
        }
        await file.delete();
        await refreshWorkspaceInstructions(context);
        return `Deleted file '${params.path}'`;
    }
});

const workspaceTools = [readFileByPathTool, createFileByPathTool, updateFileByPathTool, deleteFileByPathTool];



export const createWorkspaceHook = (root: string): FragolaHook => {
    return async (agent) => {
        const cwd = process.cwd().endsWith("/") ? process.cwd() : `${process.cwd()}/`;
        const normalizedRoot = Bun.fileURLToPath(new URL(root, Bun.pathToFileURL(cwd))).replace(/\/$/, "");
        const rootFile = Bun.file(normalizedRoot);

        if (!await rootFile.exists()) {
            throw new Error(`Workspace root '${normalizedRoot}' does not exist`);
        }

        const rootStat = await rootFile.stat();
        if (!rootStat.isDirectory()) {
            throw new Error(`Workspace root '${normalizedRoot}' is not a directory`);
        }

        if (agent.context.getStore("workspace")) {
            agent.context.removeStore("workspace");
        }
        agent.context.addStore(createStore({ root: normalizedRoot }, "workspace"));

        await refreshWorkspaceInstructions(agent.context);
        agent.context.updateTools((prev) => {
            const withoutWorkspaceTools = prev.filter((tool) => !workspaceTools.some((workspaceTool) => workspaceTool.name === tool.name));
            return [...withoutWorkspaceTools, ...workspaceTools];
        });

        return () => {
            agent.context.removeInstructions(workspaceInstructionName);
            agent.context.removeStore("workspace");
            agent.context.updateTools((prev) => prev.filter((tool) => !workspaceTools.some((workspaceTool) => workspaceTool.name === tool.name)));
        };
    };
}