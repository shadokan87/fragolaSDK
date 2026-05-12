#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

type PublicMethodInfo = {
    displayName: string,
    line: number,
    hasComment: boolean,
    hasImplementation: boolean,
};

const ANSI = {
    reset: "\u001b[0m",
    red: "\u001b[31m",
    green: "\u001b[32m",
    yellow: "\u001b[33m",
    cyan: "\u001b[36m",
    bold: "\u001b[1m",
};

const color = (text: string, tone: keyof typeof ANSI) => `${ANSI[tone]}${text}${ANSI.reset}`;

const usage = `Usage: bun scripts/check-public-method-comments.ts <file-path> <class-name>`;

const fail = (message: string): never => {
    console.error(color(message, "red"));
    console.error(color(usage, "yellow"));
    process.exit(1);
};

const getScriptKind = (filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case ".js":
        case ".mjs":
        case ".cjs":
            return ts.ScriptKind.JS;
        case ".jsx":
            return ts.ScriptKind.JSX;
        case ".tsx":
            return ts.ScriptKind.TSX;
        default:
            return ts.ScriptKind.TS;
    }
};

const hasVisibilityModifier = (node: ts.Node, kind: ts.SyntaxKind) => {
    if (!ts.canHaveModifiers(node))
        return false;

    return ts.getModifiers(node)?.some((modifier: ts.ModifierLike) => modifier.kind === kind) ?? false;
};

const isPublicMethod = (member: ts.ClassElement) => {
    if (
        !ts.isMethodDeclaration(member)
        && !ts.isGetAccessorDeclaration(member)
        && !ts.isSetAccessorDeclaration(member)
    ) {
        return false;
    }

    if (!member.name || ts.isPrivateIdentifier(member.name))
        return false;

    return !hasVisibilityModifier(member, ts.SyntaxKind.PrivateKeyword)
        && !hasVisibilityModifier(member, ts.SyntaxKind.ProtectedKeyword);
};

const getMemberDisplayName = (member: ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration) => {
    const name = member.name.getText();
    if (ts.isGetAccessorDeclaration(member))
        return `get ${name}`;
    if (ts.isSetAccessorDeclaration(member))
        return `set ${name}`;
    return name;
};

const hasLeadingJsDocComment = (member: ts.Node, sourceFile: ts.SourceFile) => {
    const fullText = sourceFile.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(fullText, member.getFullStart()) ?? [];
    return commentRanges.some((range) => {
        if (range.end > member.getStart(sourceFile) || range.kind !== ts.SyntaxKind.MultiLineCommentTrivia)
            return false;

        return fullText.slice(range.pos, range.end).startsWith("/**");
    });
};

const collectPublicMethods = (classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile) => {
    const methods = new Map<string, PublicMethodInfo>();

    for (const member of classNode.members) {
        if (!isPublicMethod(member))
            continue;

        const typedMember = member as ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration;
        const displayName = getMemberDisplayName(typedMember);
        const hasImplementation = !ts.isMethodDeclaration(typedMember) || typedMember.body !== undefined;
        const line = sourceFile.getLineAndCharacterOfPosition(typedMember.getStart(sourceFile)).line + 1;
        const candidate: PublicMethodInfo = {
            displayName,
            line,
            hasComment: hasLeadingJsDocComment(typedMember, sourceFile),
            hasImplementation,
        };

        const existing = methods.get(displayName);
        if (!existing || (!existing.hasImplementation && hasImplementation)) {
            methods.set(displayName, candidate);
        }
    }

    return [...methods.values()];
};

const findClassDeclaration = (node: ts.Node, className: string): ts.ClassDeclaration | undefined => {
    if (ts.isClassDeclaration(node) && node.name?.text === className)
        return node;

    return ts.forEachChild(node, (child) => findClassDeclaration(child, className));
};

const [fileArg, className] = process.argv.slice(2);

if (!fileArg || !className)
    fail("Missing required arguments.");

const filePath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(filePath))
    fail(`File not found: ${filePath}`);

const sourceText = fs.readFileSync(filePath, "utf8");
const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
);

const classDeclaration = findClassDeclaration(sourceFile, className);
if (!classDeclaration)
    fail(`Class '${className}' was not found in ${filePath}.`);

const targetClass = classDeclaration!;
const publicMethods = collectPublicMethods(targetClass, sourceFile);
const documentedMethods = publicMethods.filter((method) => method.hasComment);
const undocumentedMethods = publicMethods.filter((method) => !method.hasComment);

console.log(`${color("Class", "cyan")}: ${className}`);
console.log(`${color("File", "cyan")}: ${filePath}`);
console.log(`${color("Public methods", "cyan")}: ${publicMethods.length}`);

if (publicMethods.length === 0) {
    console.log(color("No public methods were found.", "yellow"));
    process.exit(0);
}

console.log(`\n${color("Methods with JSDoc comments", "green")}`);
if (documentedMethods.length === 0) {
    console.log(color("  none", "yellow"));
} else {
    for (const method of documentedMethods) {
        console.log(color(`  - ${method.displayName} (line ${method.line})`, "green"));
    }
}

console.log(`\n${color("Methods without JSDoc comments", "red")}`);
if (undocumentedMethods.length === 0) {
    console.log(color("  none", "green"));
} else {
    for (const method of undocumentedMethods) {
        console.log(color(`  - ${method.displayName} (line ${method.line})`, "red"));
    }
}

process.exit(undocumentedMethods.length === 0 ? 0 : 1);