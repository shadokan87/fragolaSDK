import type { FragolaHook } from "@fragola-ai/agent/hook";

export type TemplateOptions = {
  debug?: boolean;
};

export const __PRESET_NAME__ = (options?: TemplateOptions): FragolaHook => {
  return (lead) => {
    if (options?.debug) {
      console.debug("[hook-__PRESET_NAME__] installed on", lead?.id ?? lead);
    }
    // implement hook behavior here
  };
};

export default __PRESET_NAME__;