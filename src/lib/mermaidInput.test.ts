import { describe, expect, it } from "vitest";
import { getMermaidFrontmatterTitle, stripMermaidFences } from "./mermaidInput";

describe("stripMermaidFences", () => {
  it("returns raw Mermaid code unchanged", () => {
    const code = "flowchart TD\n  A --> B";

    expect(stripMermaidFences(code)).toBe(code);
  });

  it("strips a full mermaid Markdown fence", () => {
    expect(
      stripMermaidFences("```mermaid\nflowchart TD\n  A --> B\n```")
    ).toBe("flowchart TD\n  A --> B");
  });

  it("strips a full generic Markdown fence", () => {
    expect(stripMermaidFences("```\nsequenceDiagram\n  A->>B: Hi\n```")).toBe(
      "sequenceDiagram\n  A->>B: Hi"
    );
  });

  it("preserves internal Mermaid code fences", () => {
    expect(
      stripMermaidFences(
        "```mermaid\nflowchart TD\n  A[``` inside label] --> B\n```"
      )
    ).toBe("flowchart TD\n  A[``` inside label] --> B");
  });

  it("ignores surrounding whitespace around a full fence", () => {
    expect(stripMermaidFences("\n  ```mermaid\nflowchart LR\n  A --> B\n```\n")).toBe(
      "flowchart LR\n  A --> B"
    );
  });
});

describe("getMermaidFrontmatterTitle", () => {
  it("returns the title from Mermaid frontmatter", () => {
    expect(
      getMermaidFrontmatterTitle("---\ntitle: Customer Journey\n---\nflowchart TD\n  A --> B")
    ).toBe("Customer Journey");
  });

  it("supports quoted frontmatter titles", () => {
    expect(
      getMermaidFrontmatterTitle('---\ntitle: "LLM Generated Flow"\n---\nflowchart TD\n  A --> B')
    ).toBe("LLM Generated Flow");
  });

  it("returns null when frontmatter has no title", () => {
    expect(getMermaidFrontmatterTitle("---\nconfig:\n  theme: dark\n---\nflowchart TD")).toBeNull();
  });
});
