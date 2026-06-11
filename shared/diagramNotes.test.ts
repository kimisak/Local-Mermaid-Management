import { describe, expect, it } from "vitest";
import { briefCategoryGuideMarkdown, parseBriefMarkdown } from "./diagramNotes";

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

  it("formats the category guide as plain markdown headings and descriptions", () => {
    expect(briefCategoryGuideMarkdown()).toBe(`# General Note
Use when the consideration does not fit another category.

# Business Rule
A domain rule, policy, or invariant that must be true for the process or system.

# Assumption
Something the diagram depends on but does not prove or fully describe.

# Limitation
A known constraint, simplification, excluded scenario, or scope boundary.

# Constraint
A restriction the process, solution, or system must respect.

# Pain Point
A current problem, friction, inefficiency, ambiguity, or failure mode.

# Decision
A selected design, product, process, or architecture choice captured with the diagram.

# Open Question
An unresolved issue that needs clarification, validation, or follow-up.

# Element Note
A note about a specific node, entity, relation, edge, actor, system, process step, or other diagram element.

# Boundary / Edge Case
Boundary values, equivalence cases, exceptions, alternate paths, or error conditions.

# Data / Integration
Inputs, outputs, payloads, events, APIs, files, systems, or dependencies.

# Compliance / Policy
Legal, security, privacy, audit, governance, regulatory, or internal policy considerations.`);
  });
});
