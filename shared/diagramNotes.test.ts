import { describe, expect, it } from "vitest";
import { parseBriefMarkdown } from "./diagramNotes";

describe("parseBriefMarkdown", () => {
  it("parses recognized category headings and keeps markdown content inside each section", () => {
    expect(
      parseBriefMarkdown(`# Business Rule
1. first rule
2. second rule

## Details
Some text.

# Compliance
> legal text`)
    ).toEqual([
      {
        categoryId: "business-rule",
        label: "Business Rule",
        markdown: "1. first rule\n2. second rule\n\n## Details\nSome text."
      },
      {
        categoryId: "compliance-policy",
        label: "Compliance / Policy",
        markdown: "> legal text"
      }
    ]);
  });

  it("puts preamble text into General Note", () => {
    expect(parseBriefMarkdown("Some standalone context.")).toEqual([
      {
        categoryId: "general-note",
        label: "General Note",
        markdown: "Some standalone context."
      }
    ]);
  });

  it("treats any top-level heading as a brief section label", () => {
    expect(
      parseBriefMarkdown(`# Forretningsregler
- Booking = kapasitetsreservasjon [R0-1]

# Mål
- Øke andel Flex [M0-1]

# Praksis (avvik fra vilkår)
- Overbooking [P0-1]`)
    ).toEqual([
      {
        categoryId: "general-note",
        label: "Forretningsregler",
        markdown: "- Booking = kapasitetsreservasjon [R0-1]"
      },
      {
        categoryId: "general-note",
        label: "Mål",
        markdown: "- Øke andel Flex [M0-1]"
      },
      {
        categoryId: "general-note",
        label: "Praksis (avvik fra vilkår)",
        markdown: "- Overbooking [P0-1]"
      }
    ]);
  });
});
