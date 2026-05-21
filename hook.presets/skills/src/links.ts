import path from "node:path";

import type { SkillLink } from "./types";

export const SKILL_URL_PREFIX = "skill://";

function normalizeRelativePath(relativePath: string) {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));

  if (normalized === ".")
    return "";

  return normalized.replace(/^\.\//, "");
}

function isExternalLink(href: string) {
  return /^(?:[a-z]+:|#|\/)/i.test(href);
}

export function buildSkillUrl(resolvedName: string, relativePath: string) {
  const normalizedPath = normalizeRelativePath(relativePath);
  return `${SKILL_URL_PREFIX}${resolvedName}/${normalizedPath}`;
}

export function parseSkillUrl(url: string) {
  if (!url.startsWith(SKILL_URL_PREFIX))
    return null;

  const withoutPrefix = url.slice(SKILL_URL_PREFIX.length);
  const slashIndex = withoutPrefix.indexOf("/");

  if (slashIndex === -1)
    return null;

  const resolvedName = withoutPrefix.slice(0, slashIndex);
  const relativePath = normalizeRelativePath(withoutPrefix.slice(slashIndex + 1));

  if (!resolvedName || !relativePath)
    return null;

  return {
    resolvedName,
    relativePath,
  };
}

export function isAllowedSkillRelativePath(relativePath: string) {
  const normalizedPath = normalizeRelativePath(relativePath);

  if (!normalizedPath || normalizedPath.startsWith("../"))
    return false;

  return normalizedPath === "SKILL.md"
    || normalizedPath.startsWith("references/")
    || normalizedPath.startsWith("assets/");
}

export function rewriteSkillLinks(body: string, localRoot: string, resolvedName: string) {
  const links = new Map<string, SkillLink>();

  const renderedBody = body.replace(/(!?\[([^\]]*)\]\(([^)]+)\))/g, (fullMatch, _whole, label: string, rawHref: string) => {
    const href = rawHref.trim();

    if (!href || isExternalLink(href) || href.startsWith(SKILL_URL_PREFIX))
      return fullMatch;

    const basePath = path.resolve(localRoot, href);
    const relativePath = normalizeRelativePath(path.relative(localRoot, basePath));

    if (!isAllowedSkillRelativePath(relativePath))
      return fullMatch;

    const url = buildSkillUrl(resolvedName, relativePath);

    links.set(url, {
      label: label || relativePath,
      url,
      localPath: basePath,
    });

    return fullMatch.replace(rawHref, url);
  });

  return {
    renderedBody,
    links: [...links.values()],
  };
}
