const FENCED_MERMAID_PATTERN = /^```(?:mermaid)?[ \t]*\r?\n([\s\S]*)\r?\n```[ \t]*$/i;
const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const TITLE_PATTERN = /^title:[ \t]*(.+?)[ \t]*$/im;

export function stripMermaidFences(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(FENCED_MERMAID_PATTERN);

  return match ? match[1] : value;
}

export function getMermaidFrontmatterTitle(value: string): string | null {
  const frontmatter = value.trimStart().match(FRONTMATTER_PATTERN)?.[1];

  if (!frontmatter) {
    return null;
  }

  const title = frontmatter.match(TITLE_PATTERN)?.[1]?.trim();

  if (!title) {
    return null;
  }

  return title.replace(/^['"]|['"]$/g, "").trim() || null;
}
