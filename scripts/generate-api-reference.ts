#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const TARGETS = [
    { file: "src/fragola.ts", name: "Fragola", out: "docs/content/docs/fragola-class.mdx" },
    { file: "src/agent.ts", name: "Agent", out: "docs/content/docs/agent-class.mdx" },
    { file: "src/agentContext.ts", name: "AgentContext", out: "docs/content/docs/agent-context-class.mdx" }
];

const getScriptKind = (filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".tsx") return ts.ScriptKind.TSX;
    return ts.ScriptKind.TS;
};

const hasVisibilityModifier = (node: ts.Node, kind: ts.SyntaxKind) => {
    if (!ts.canHaveModifiers(node)) return false;
    return ts.getModifiers(node)?.some((m: ts.ModifierLike) => m.kind === kind) ?? false;
};

const isPublic = (member: ts.ClassElement) => {
    if (ts.isConstructorDeclaration(member)) {
        return !hasVisibilityModifier(member, ts.SyntaxKind.PrivateKeyword) &&
               !hasVisibilityModifier(member, ts.SyntaxKind.ProtectedKeyword);
    }
    if (!member.name || ts.isPrivateIdentifier(member.name)) return false;
    if (member.name.getText().startsWith('#')) return false;

    return !hasVisibilityModifier(member, ts.SyntaxKind.PrivateKeyword)
        && !hasVisibilityModifier(member, ts.SyntaxKind.ProtectedKeyword);
};

const getJsDoc = (node: ts.Node, sourceFile: ts.SourceFile) => {
    const fullText = sourceFile.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(fullText, node.getFullStart()) ?? [];
    const jsDocRanges = commentRanges.filter(r => r.kind === ts.SyntaxKind.MultiLineCommentTrivia && fullText.slice(r.pos, r.end).startsWith("/**"));
    if (jsDocRanges.length === 0) return "";
    const lastRange = jsDocRanges[jsDocRanges.length - 1];
    let comment = fullText.slice(lastRange.pos, lastRange.end);
    comment = comment.replace(/^\/\*\*/, '').replace(/\*\/$/, '');
    
    let lines = comment.split('\n').map(line => line.replace(/^\s*\*\s?/, ''));
    
    let inExample = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('@example')) {
            inExample = true;
            lines[i] = lines[i].replace('@example', '**Example**\n\n```typescript');
        } else if (inExample && lines[i].startsWith('@') && !lines[i].startsWith('@link')) {
            lines.splice(i, 0, '```\n');
            inExample = false;
            i++;
        }
    }
    if (inExample) {
        lines.push('```');
    }
    
    let processed = lines.join('\n').trim();
    processed = processed.replace(/@param\s+([a-zA-Z0-9_]+)\s+-?\s*(.*)/g, '- `$1`: $2');
    
    processed = processed.replace(/@returns\s+(.*)/g, (match, p1) => {
        return '**Returns:** `' + p1 + '`'; 
    });
    
    processed = processed.replace(/@throws\s+{([^}]+)}\s*(.*)/g, '**Throws:** `$1` $2');
    processed = processed.replace(/{@link\s+([^}]+)}/g, '`$1`');
    
    return processed;
};

const getSignature = (member: ts.Node, sourceFile: ts.SourceFile) => {
    if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
        const body = (member as any).body;
        let sigEnd = body ? body.getFullStart() : member.getEnd();
        return sourceFile.getFullText().slice(member.getStart(sourceFile), sigEnd).trim().replace(/\s*{\s*$/, '').replace(/;$/, '');
    }
    if (ts.isPropertyDeclaration(member)) {
        return member.getText(sourceFile).trim().replace(/;$/, '');
    }
    return member.getText(sourceFile).trim();
};

const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const generateMarkdown = (className: string, members: any[]) => {
    let md = `---
title: ${className} Class
---

# \`${className}\` API Reference

`;

    const properties = members.filter(m => m.kind === 'property' || m.kind === 'accessor');
    const methods = members.filter(m => m.kind === 'method');
    const constructors = members.filter(m => m.kind === 'constructor');

    const classSlug = slugify(className);

    if (constructors.length > 0) {
        md += `## Constructor [#${classSlug}-constructor]\n\n`;
        for (const ctor of constructors) {
            if (ctor.doc) md += `${ctor.doc}\n\n`;
            md += `\`\`\`typescript\n${ctor.signature}\n\`\`\`\n\n`;
        }
    }

    if (properties.length > 0) {
        md += `## Properties [#${classSlug}-properties]\n\n`;
        for (const prop of properties) {
            // Remove backticks from heading to prevent duplicate IDs in Fumadocs due to escaping
            md += `### ${prop.name} [#${classSlug}-${slugify(prop.name)}]\n`;
            if (prop.doc) md += `${prop.doc}\n\n`;
            md += `\`\`\`typescript\n${prop.signature}\n\`\`\`\n\n`;
        }
    }

    if (methods.length > 0) {
        md += `## Methods [#${classSlug}-methods]\n\n`;
        for (const method of methods) {
            // Remove backticks from heading to prevent duplicate IDs in Fumadocs due to escaping
            md += `### ${method.name} [#${classSlug}-${slugify(method.name)}]\n`;
            if (method.doc) md += `${method.doc}\n\n`;
            md += `\`\`\`typescript\n${method.signature}\n\`\`\`\n\n`;
        }
    }

    return md;
};

async function main() {
    for (const target of TARGETS) {
        const filePath = path.resolve(process.cwd(), target.file);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            continue;
        }

        const sourceText = fs.readFileSync(filePath, "utf8");
        const sourceFile = ts.createSourceFile(
            filePath,
            sourceText,
            ts.ScriptTarget.Latest,
            true,
            getScriptKind(filePath)
        );

        let classNode: ts.ClassDeclaration | undefined;
        const findClass = (node: ts.Node) => {
            if (ts.isClassDeclaration(node) && node.name?.text === target.name) {
                classNode = node;
            }
            ts.forEachChild(node, findClass);
        };
        findClass(sourceFile);

        if (!classNode) {
            console.error(`Class ${target.name} not found in ${target.file}`);
            continue;
        }

        const extractedMembers = [];

        // Track seen names to avoid duplicates (like getters/setters with the same name, or overloaded methods)
        const seenNames = new Set<string>();

        for (const member of classNode.members) {
            if (!isPublic(member)) continue;

            const name = member.name ? member.name.getText(sourceFile) : (ts.isConstructorDeclaration(member) ? 'constructor' : 'unknown');
            
            // Skip overloads or getter/setter duplicates
            if (seenNames.has(name) && name !== 'constructor') continue;
            seenNames.add(name);

            const doc = getJsDoc(member, sourceFile);
            let signature = getSignature(member, sourceFile);

            let kind = 'unknown';
            if (ts.isConstructorDeclaration(member)) kind = 'constructor';
            else if (ts.isMethodDeclaration(member)) kind = 'method';
            else if (ts.isPropertyDeclaration(member)) kind = 'property';
            else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) kind = 'accessor';

            extractedMembers.push({ name, doc, signature, kind });
        }

        const mdxContent = generateMarkdown(target.name, extractedMembers);
        const outPath = path.resolve(process.cwd(), target.out);
        
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, mdxContent);
        console.log(`Generated API Reference for ${target.name} -> ${target.out}`);
    }
}

main().catch(console.error);
