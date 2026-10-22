import type { CLIOptions } from './';

export function toMcpArgs(options: CLIOptions, secretsFile?: string): string[] {
  const args: string[] = [];

  const value = (flag: string, item: string | number | undefined) => {
    if (item !== undefined)
      args.push(`${flag}=${item}`);
  };
  const enabled = (flag: string, item: boolean | undefined) => {
    if (item)
      args.push(flag);
  };
  const list = (flag: string, items: string[] | undefined, separator = ',') => {
    if (items?.length)
      args.push(`${flag}=${items.join(separator)}`);
  };
  const paths = (flag: string, items: string[] | undefined) => {
    if (items?.length)
      args.push(flag, ...items);
  };
  const headers = (flag: string, items: Record<string, string> | undefined) => {
    for (const [name, headerValue] of Object.entries(items ?? {}))
      args.push(flag, `${name}: ${headerValue}`);
  };

  list('--allowed-hosts', options.allowedHosts);
  list('--allowed-origins', options.allowedOrigins, ';');
  enabled('--allow-unrestricted-file-access', options.allowUnrestrictedFileAccess);
  list('--blocked-origins', options.blockedOrigins, ';');
  enabled('--block-service-workers', options.blockServiceWorkers);
  value('--browser', options.browser);
  list('--caps', options.caps);
  value('--cdp-endpoint', options.cdpEndpoint);
  headers('--cdp-header', options.cdpHeader);
  value('--cdp-timeout', options.cdpTimeout);
  value('--codegen', options.codegen);
  value('--config', options.config);
  value('--console-level', options.consoleLevel);
  value('--device', options.device);
  value('--endpoint', options.endpoint);
  enabled('--extension', options.extension);
  value('--executable-path', options.executablePath);
  list('--grant-permissions', options.grantPermissions);
  enabled('--headless', options.headless);
  value('--host', options.host);
  enabled('--ignore-https-errors', options.ignoreHttpsErrors);
  paths('--init-page', options.initPage);
  paths('--init-script', options.initScript);
  enabled('--isolated', options.isolated);
  value('--image-responses', options.imageResponses);
  enabled('--mobile', options.mobile);

  if (options.sandbox === true)
    args.push('--sandbox');
  else if (options.sandbox === false)
    args.push('--no-sandbox');

  value('--output-dir', options.outputDir);
  value('--output-max-size', options.outputMaxSize);
  value('--port', options.port);
  value('--proxy-bypass', options.proxyBypass);
  value('--proxy-server', options.proxyServer);
  headers('--remote-header', options.remoteHeader);
  enabled('--save-session', options.saveSession);

  if (options.secrets !== undefined) {
    if (!secretsFile)
      throw new Error('CLI --secrets requires a dotenv file path; it cannot take a secrets object.');
    value('--secrets', secretsFile);
  }

  enabled('--shared-browser-context', options.sharedBrowserContext);
  value('--snapshot-mode', options.snapshotMode);
  value('--storage-state', options.storageState);
  value('--test-id-attribute', options.testIdAttribute);
  value('--timeout-action', options.timeoutAction);
  value('--timeout-navigation', options.timeoutNavigation);
  value('--user-agent', options.userAgent);
  value('--user-data-dir', options.userDataDir);

  if (options.viewportSize)
    value('--viewport-size', `${options.viewportSize.width}x${options.viewportSize.height}`);

  return args;
}