import { Fragola, type DefineMetaData } from "./src/fragola";
import z from "zod";
import { createStore, type JsonQuery } from "@src/agent";
import { date } from "node_modules/zod/dist/types/v4/mini/coerce";
import { guardrail, GuardrailConstrain, type Guardrail, type GuardRailMeta } from "@src/hook/presets/guardrail";
import { fileSystemSave } from "@src/hook/presets/fileSystemSave";
import { orchestration, type OrchestrationType } from "@src/hook/presets/orchestration";

const fragola = new Fragola({
    baseURL: process.env.TEST_BASEURL,
    apiKey: process.env.TEST_API_KEY,
    model: "gpt-4.1-mini"
});

const store = createStore({
    "test": true
});

type meta = DefineMetaData<{
    "user": GuardRailMeta
}>;

// demo json mode
const agent = fragola.agent<meta, typeof store.value>({
    name: "assistant",
    instructions: "you are a helpful assistant",
    description: "assistant agent",
    store
});

agent.use(fileSystemSave("./testHook"));

const isAboutMath: Guardrail = (async (fail, userMessage, { instance }) => {
    const topicIsMath = await instance.boolean(`This user message topic is about mathematics: ${userMessage.content}`);
    if (topicIsMath)
        return fail(`${userMessage.content} contain math questions, try again with another question`);
});
const summaryAgent = agent.fork();
const computerUse = agent.fork();
const searchWeb = agent.fork();

agent.use(orchestration((lead) => {
    return {
        participants: [lead, summaryAgent, searchWeb, computerUse],
        flow: [
            [lead, "*"],
            [searchWeb, { to: computerUse }],
            [searchWeb, { to: summaryAgent }],
            [summaryAgent, { to: lead }]
        ],
        // Intercept and control agents communications. Messages can be rejected or modified similar to `onUserMessage` event
        onMessage: ((source, dest, message, reject) => {
            if (dest.state.status != "idle")
                return reject(`Cannot send a message to agent ${dest.options.name} while is generating`);
            else
                return message;
        })
    }
}));

// agent.use(guardrail([isAboutMath], "keepAndAnnotate"));
// // agent.use(orchestration((flow, lead) => {
// //     return [
// //         flow(lead, "*", "bidirection"),
// //         flow(searchWeb, computerUse),
// //         flow(searchWeb, summaryAgent),
// //         flow(summaryAgent, lead)
// //     ]
// // }));

// try {
//     console.log("#br1");
//     const response = await agent.userMessage({ content: "what is 2 + 2" });
//     console.log("#br2");
//     console.log(JSON.stringify(response, null, 2));
// } catch (e) {
//     console.log("#br3");
//     console.error(e);
//     if (e instanceof GuardrailConstrain) {
//         console.error(`Message rejected, trying again ...`);
//         // const state = await agent.userMessage({content: "say hello "});
//         // console.log("state", JSON.stringify(state, null, 2));
//     }
// }