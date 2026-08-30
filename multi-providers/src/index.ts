import { ProviderName, Provider } from "./types/providers";
import {FragolaHook} from "../../src/hook/index";

export const provider = <K extends ProviderName>(name: K, config: Provider<K>): FragolaHook => (agent) => {
    return () => {

    }
}

provider("openai", {})