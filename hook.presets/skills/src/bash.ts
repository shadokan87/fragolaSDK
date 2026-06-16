import { execa } from "execa";
import { tool } from "@fragola-ai/agent";
import type { AgentAny } from "@fragola-ai/agent/agent";
import type { FragolaHook } from "@fragola-ai/agent/hook";
import z from "zod";

export const bashInstructionName = "bash";

const bashInstructions = [
    "Use the bash command tool when you need to run a local command.",
    "Pass the executable name in `command` and each argument separately in `args`.",
    "The command is executed through `bash -lc`, so shell operators such as pipes, redirects, wildcards, and command chaining are supported.",
    "`command` and `args` are joined with spaces before execution. If a token needs shell quoting, include that quoting in the string you pass.",
    "The result includes `exitCode`, `stdout`, `stderr`, and an empty `stdin` string because interactive input is not supported."
].join("\n");

type BashToolResult = {
    exitCode: number;
    stdin: string;
    stdout: string;
    stderr: string;
};

const getErrorString = (value: unknown): string => {
    return value instanceof Error ? value.message : String(value);
};

const getErrorResult = (error: unknown): BashToolResult => {
    if (typeof error === "object" && error !== null) {
        const exitCode = typeof (error as { exitCode?: unknown }).exitCode === "number"
            ? (error as { exitCode: number }).exitCode
            : -1;
        const stdout = typeof (error as { stdout?: unknown }).stdout === "string"
            ? (error as { stdout: string }).stdout
            : "";
        const stderr = typeof (error as { stderr?: unknown }).stderr === "string"
            ? (error as { stderr: string }).stderr
            : getErrorString(error);

        return { exitCode, stdin: "", stdout, stderr };
    }

    return { exitCode: -1, stdin: "", stdout: "", stderr: getErrorString(error) };
};

const bashSchema = z.object({
    command: z.string().min(1).describe("The executable to run, for example `git`, `ls`, or `node`."),
    args: z.array(z.string()).max(50).optional().describe("Arguments passed to the command, one array element per argument.")
});

export const bashTool = tool({
    name: "bash-command",
    description: "Run a local bash command from command and args. Supports shell operators and returns exitCode, stdout, stderr, and an empty stdin field.",
    schema: bashSchema,
    async handler(params): Promise<BashToolResult> {
        const { command, args = [] } = params;
        const commandLine = [command, ...args].join(" ");

        try {
            const result = await execa("bash", ["-lc", commandLine], {
                reject: false,
                stdin: "ignore"
            });

            return {
                exitCode: result.exitCode ?? -1,
                stdin: "",
                stdout: result.stdout,
                stderr: result.stderr
            };
        } catch (error) {
            return getErrorResult(error);
        }
    }
});

export type BashHookOptions = {
    execute?: (params: z.infer<typeof bashSchema>) => Promise<BashToolResult> | BashToolResult;
}

export const bashHook = (options?: BashHookOptions): FragolaHook => (agent: AgentAny) => {
    agent.context.setInstructions(bashInstructions, bashInstructionName);
    // const _bashTool = 
    agent.context.updateTools((prev) => {
        return [...prev, bashTool];
    });

    return () => {
        agent.context.removeInstructions(bashInstructionName);
        agent.context.updateTools((prev) => prev.filter((toolEntry) => toolEntry.name !== bashTool.name));
    };
};

export default bashHook;