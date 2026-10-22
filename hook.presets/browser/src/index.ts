import type { FragolaHook } from "@fragola-ai/agent/hook";
import { detect } from 'package-manager-detector/detect';
import { type AgentName } from "package-manager-detector";
import mcp from "../../mcp-client/src/index";
import { toMcpArgs } from "./uilts";

export type ViewportSize = { width: number; height: number };

export type CLIOptions = {
  allowedHosts?: string[];
  allowedOrigins?: string[];
  allowUnrestrictedFileAccess?: boolean;
  blockedOrigins?: string[];
  blockServiceWorkers?: boolean;
  browser?: string;
  caps?: string[];
  cdpEndpoint?: string;
  cdpHeader?: Record<string, string>;
  cdpTimeout?: number;
  codegen?: 'typescript' | 'none';
  config?: string;
  consoleLevel?: 'error' | 'warning' | 'info' | 'debug';
  device?: string;
  endpoint?: string;
  extension?: boolean;
  executablePath?: string;
  grantPermissions?: string[];
  headless?: boolean;
  host?: string;
  ignoreHttpsErrors?: boolean;
  initScript?: string[];
  initPage?: string[];
  isolated?: boolean;
  imageResponses?: 'allow' | 'omit';
  mobile?: boolean;
  sandbox?: boolean;
  outputDir?: string;
  outputMaxSize?: number;
  port?: number;
  proxyBypass?: string;
  proxyServer?: string;
  remoteHeader?: Record<string, string>;
  saveSession?: boolean;
  secrets?: Record<string, string>;
  sharedBrowserContext?: boolean;
  snapshotMode?: 'full' | 'none';
  storageState?: string;
  testIdAttribute?: string;
  timeoutAction?: number;
  timeoutNavigation?: number;
  userAgent?: string;
  userDataDir?: string;
  viewportSize?: ViewportSize;
};

export type browserOptions = {
  debug?: boolean;
  packageManager?: AgentName
} & CLIOptions;

export const browser = (options?: browserOptions): FragolaHook => {
  return async (agent) => {
    let args: string[] = [];

    const pm = await (async () => {
      if (options?.packageManager)
        return options.packageManager;
      const detected = await detect({
        strategies: ['install-metadata', 'lockfile', 'packageManager-field', 'devEngines-field']
      });
      if (detected)
        return detected.name;
      else
        return "npm";
    })();

    if (options) {
      const { debug, packageManager, ...cliOpts } = options;
      args = toMcpArgs(cliOpts);
    }
    const pmExecCommand = (() => {
      switch (pm) {
        case "npm":
        case "yarn":
          return { command: "npx", args: ["-y"] };
        case "pnpm":
          return { command: "pnpm", args: ["dlx"] };
        case "bun":
          return { command: "bun", args: ["x"] };
        case "deno":
          return { command: "deno", args: ["x"] };
        case "nub":
          return { command: "nubx", args: [] };
        case "aube":
          return { command: "aube", args: ["dlx"] };
        case "upm":
          return { command: "upx", args: [] };
      }
    })();
    agent.use(mcp({
      name: "playwright_browser",
      command: pmExecCommand.command,
      args: [...pmExecCommand.args, "@playwright/mcp@latest", ...args],
    }), "playwright_browser");
    if (options?.debug) {
      console.debug("[hook-browser] installed on", agent?.id ?? agent);
    }
    return () => {
      agent.removeHook("playwright_browser")
    }
  };
};

export default browser;