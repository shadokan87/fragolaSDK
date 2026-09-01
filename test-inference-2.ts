import * as ts from "typescript";

const code = `
import { ProviderName, Provider } from "./types/providers";
import { FragolaHook } from "../../src/hook/index";

export const provider = <K extends ProviderName>(name: K, config: Provider<K>): FragolaHook => (agent) => {
    agent.onBeforeModelInvocation(({ context, config }) => {
        context.
        return config;
    });
}
`;
const host = ts.createCompilerHost({});
const originalGetSourceFile = host.getSourceFile;
host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (fileName === "dummy.ts") {
        return ts.createSourceFile(fileName, code, languageVersion);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
};
const program = ts.createProgram(["dummy.ts"], {});
const checker = program.getTypeChecker();
const sf = program.getSourceFile("dummy.ts");

// find context.
function findDot(node: ts.Node): ts.PropertyAccessExpression | undefined {
    if (ts.isPropertyAccessExpression(node) && node.expression.getText() === "context") {
        return node;
    }
    return ts.forEachChild(node, findDot);
}

const dot = findDot(sf!);
if (dot) {
    const type = checker.getTypeAtLocation(dot.expression);
    console.log("type is:", checker.typeToString(type));
}
