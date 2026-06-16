import { createRequire } from "node:module";
import type * as Dockerode from "dockerode";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { resolve } from "node:path";
import { tool } from "@fragola-ai/agent";
import type { AgentAny } from "@fragola-ai/agent/agent";
import type { FragolaHook } from "@fragola-ai/agent/hook";
import z from "zod";

export const workspaceInstructionName = "workspace";
export const workspaceToolName = "workspace-bash-command";

const defaultImage = "ubuntu:24.04";
const defaultMountPath = "/workspace";

const createWorkspaceInstructions = (mountPath: string) => [
    "Use the workspace command tool when you need to run commands inside the Docker workspace container.",
    "Pass the executable name in `command` and each argument separately in `args`.",
    "The command is executed through `bash -lc`, so shell operators such as pipes, redirects, wildcards, and command chaining are supported.",
    "`command` and `args` are joined with spaces before execution. If a token needs shell quoting, include that quoting in the string you pass.",
    `The container working directory is ${mountPath}.`,
    "The result includes `exitCode`, `stdout`, `stderr`, and an empty `stdin` string because interactive input is not supported."
].join("\n");

export type WorkspaceToolResult = {
    exitCode: number;
    stdin: string;
    stdout: string;
    stderr: string;
};

export type WorkspaceVolume = {
    hostPath: string;
    containerPath: string;
    readOnly?: boolean;
};

export type WorkspaceHookOptions = {
    image?: string;
    workspacePath?: string;
    mountPath?: string;
    volumes?: WorkspaceVolume[];
    containerName?: string;
    debug?: boolean;
    docker?: Dockerode;
    dockerOptions?: Dockerode.DockerOptions;
    execute?: (params: z.infer<typeof workspaceSchema>) => Promise<WorkspaceToolResult> | WorkspaceToolResult;
};

const getErrorString = (value: unknown): string => {
    return value instanceof Error ? value.message : String(value);
};

const getErrorResult = (error: unknown): WorkspaceToolResult => {
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

const workspaceSchema = z.object({
    command: z.string().min(1).describe("The executable to run inside the workspace container, for example `git`, `ls`, or `node`."),
    args: z.array(z.string()).max(50).optional().describe("Arguments passed to the command, one array element per argument.")
});

const require = createRequire(import.meta.url);
const DockerConstructor = require("dockerode") as {
    new(options?: Dockerode.DockerOptions): Dockerode;
};

const getDefaultDockerOptions = (): Dockerode.DockerOptions | undefined => {
    if (process.platform === "win32") {
        return undefined;
    }

    return {
        socketPath: process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock"
    };
};

const resolveDockerOptions = (options: WorkspaceHookOptions): Dockerode.DockerOptions | undefined => {
    return options.dockerOptions ?? getDefaultDockerOptions();
};

const connectDocker = (options: WorkspaceHookOptions): Dockerode => {
    if (options.docker) {
        return options.docker;
    }

    return new DockerConstructor(resolveDockerOptions(options));
};

const assertDockerSocketAccess = async (dockerOptions: Dockerode.DockerOptions | undefined): Promise<void> => {
    const socketPath = dockerOptions?.socketPath;
    if (!socketPath) {
        return;
    }

    try {
        await access(socketPath, constants.R_OK | constants.W_OK);
    } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined;
        if (code === "EACCES") {
            throw new Error(
                `Docker socket exists but is not accessible at '${socketPath}'. ` +
                `Your user likely does not have permission to access the Docker daemon. ` +
                `Add the user to the docker group or run with appropriate privileges.`
            );
        }

        if (code === "ENOENT") {
            throw new Error(`Docker socket was not found at '${socketPath}'. Is Docker installed and running?`);
        }

        throw error;
    }
};

const assertDockerReachable = async (docker: Dockerode, dockerOptions: Dockerode.DockerOptions | undefined): Promise<void> => {
    await assertDockerSocketAccess(dockerOptions);

    try {
        await docker.ping();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
            `Failed to connect to Docker daemon. ` +
            `Tried the configured Docker client options${process.platform === "win32" ? "" : ` (default socket: ${process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock"})`}. ` +
            `Original error: ${message}`
        );
    }
};

const waitForStream = (stream: NodeJS.ReadableStream): Promise<void> => {
    return new Promise((resolvePromise, rejectPromise) => {
        stream.once("end", () => resolvePromise());
        stream.once("error", rejectPromise);
    });
};

const pullImageIfMissing = async (docker: Dockerode, image: string): Promise<void> => {
    try {
        await docker.getImage(image).inspect();
        return;
    } catch {
        await new Promise<void>((resolvePromise, rejectPromise) => {
            docker.pull(image, (error: Error | null, stream?: NodeJS.ReadableStream) => {
                if (error) {
                    rejectPromise(error);
                    return;
                }
                if (!stream) {
                    rejectPromise(new Error(`Docker did not return a pull stream for image '${image}'.`));
                    return;
                }
                docker.modem.followProgress(stream, (progressError: Error | null) => {
                    if (progressError) {
                        rejectPromise(progressError);
                        return;
                    }
                    resolvePromise();
                });
            });
        });
    }
};

const toBind = (volume: WorkspaceVolume): string => {
    const hostPath = resolve(volume.hostPath);
    const suffix = volume.readOnly ? ":ro" : "";
    return `${hostPath}:${volume.containerPath}${suffix}`;
};

const runCommandInContainer = async (
    docker: Dockerode,
    container: Dockerode.Container,
    mountPath: string,
    params: z.infer<typeof workspaceSchema>
): Promise<WorkspaceToolResult> => {
    const { command, args = [] } = params;
    const commandLine = [command, ...args].join(" ");

    try {
        const exec = await container.exec({
            Cmd: ["bash", "-lc", commandLine],
            AttachStdout: true,
            AttachStderr: true,
            WorkingDir: mountPath,
        });

        const stream = await exec.start({ hijack: false, stdin: false });
        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        stdoutStream.on("data", (chunk) => {
            stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stderrStream.on("data", (chunk) => {
            stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        docker.modem.demuxStream(stream, stdoutStream, stderrStream);
        await waitForStream(stream);

        const inspection = await exec.inspect();
        return {
            exitCode: inspection.ExitCode ?? -1,
            stdin: "",
            stdout: Buffer.concat(stdoutChunks).toString("utf8"),
            stderr: Buffer.concat(stderrChunks).toString("utf8")
        };
    } catch (error) {
        return getErrorResult(error);
    }
};

export const workspaceHook = (options: WorkspaceHookOptions = {}): FragolaHook => {
    return async (agent: AgentAny) => {
        const dockerOptions = resolveDockerOptions(options);
        const docker = connectDocker(options);
        const image = options.image ?? defaultImage;
        const mountPath = options.mountPath ?? defaultMountPath;
        const workspacePath = resolve(options.workspacePath ?? process.cwd());
        const debugLog = (...args: unknown[]) => {
            if (options.debug) {
                console.log("[workspace-hook]", ...args);
            }
        };

        debugLog("starting container", { image, workspacePath, mountPath });
    await assertDockerReachable(docker, dockerOptions);
        await pullImageIfMissing(docker, image);

        const container = await docker.createContainer({
            Image: image,
            name: options.containerName,
            WorkingDir: mountPath,
            Cmd: ["bash", "-lc", "trap 'exit 0' TERM INT; while true; do sleep 3600; done"],
            Tty: false,
            AttachStdout: false,
            AttachStderr: false,
            HostConfig: {
                AutoRemove: false,
                NetworkMode: "none",
                Binds: [
                    toBind({ hostPath: workspacePath, containerPath: mountPath }),
                    ...(options.volumes ?? []).map(toBind)
                ]
            }
        });

        await container.start();
        debugLog("container started", container.id);

        const workspaceTool = tool({
            name: workspaceToolName,
            description: "Run a bash command. Supports shell operators and returns exitCode, stdout, stderr, and an empty stdin field.",
            schema: workspaceSchema,
            async handler(params): Promise<WorkspaceToolResult> {
                const execute = options.execute ?? ((toolParams: z.infer<typeof workspaceSchema>) => runCommandInContainer(docker, container, mountPath, toolParams));
                return await execute(params);
            }
        });

        agent.context.setInstructions(createWorkspaceInstructions(mountPath), workspaceInstructionName);
        agent.context.updateTools((prev) => [...prev, workspaceTool]);

        return async () => {
            agent.context.removeInstructions(workspaceInstructionName);
            agent.context.updateTools((prev) => prev.filter((toolEntry) => toolEntry.name !== workspaceTool.name));

            try {
                debugLog("stopping container", container.id);
                await container.stop({ t: 0 });
            } catch {
                debugLog("container stop skipped", container.id);
            }

            try {
                await container.remove({ force: true });
                debugLog("container removed", container.id);
            } catch {
                debugLog("container removal skipped", container.id);
            }
        };
    };
};

export default workspaceHook;