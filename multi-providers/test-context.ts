import { ProviderName, Provider } from "./src/types/providers";
import { FragolaHook } from "../src/hook/index";
import { AgentAny } from "../src/agent";

const testProvider = <K extends ProviderName>(name: K, config: Provider<K>): FragolaHook => (agent) => {
    agent.onBeforeModelInvocation(({ context, config }) => {
        // Here we test what `context` type is inferred as
        let c = context;
        c.setOptions
    });
}
