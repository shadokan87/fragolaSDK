import * as ts from "typescript";

const code = `
import { ProviderName, Provider } from "./src/types/providers";
import { FragolaHook } from "../src/hook/index";
export const provider = <K extends ProviderName>(name: K, config: Provider<K>): FragolaHook => (agent) => {
    agent.onBeforeModelInvocation(({ context, config }) => {
        context.setOptions;
        return config;
    });
}
`;
const options: ts.CompilerOptions = { strict: true };
const host = ts.createCompilerHost(options);
const program = ts.createProgram(["multi-providers/test-context.ts"], options, host);
const checker = program.getTypeChecker();
const sf = program.getSourceFile("multi-providers/test-context.ts");

function findContextSetOptions(node: ts.Node): ts.PropertyAccessExpression | undefined {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "setOptions") {
        return node;
    }
    return ts.forEachChild(node, findContextSetOptions);
}

if (sf) {
    const node = findContextSetOptions(sf);
    if (node) {
        const type = checker.getTypeAtLocation(node.expression);
        console.log("context type is: ", checker.typeToString(type));
    }
}
