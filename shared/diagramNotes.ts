export const noteCategories = [
  {
    id: "general-note",
    label: "General Note",
    description: "Use when the consideration does not fit another category."
  },
  {
    id: "business-rule",
    label: "Business Rule",
    description: "A domain rule, policy, or invariant that must be true for the process or system."
  },
  {
    id: "assumption",
    label: "Assumption",
    description: "Something the diagram depends on but does not prove or fully describe."
  },
  {
    id: "limitation",
    label: "Limitation",
    description: "A known constraint, simplification, excluded scenario, or scope boundary."
  },
  {
    id: "constraint",
    label: "Constraint",
    description: "A restriction the process, solution, or system must respect."
  },
  {
    id: "pain-point",
    label: "Pain Point",
    description: "A current problem, friction, inefficiency, ambiguity, or failure mode."
  },
  {
    id: "decision",
    label: "Decision",
    description: "A selected design, product, process, or architecture choice captured with the diagram."
  },
  {
    id: "open-question",
    label: "Open Question",
    description: "An unresolved issue that needs clarification, validation, or follow-up."
  },
  {
    id: "element-note",
    label: "Element Note",
    description:
      "A note about a specific node, entity, relation, edge, actor, system, process step, or other diagram element."
  },
  {
    id: "boundary-edge-case",
    label: "Boundary / Edge Case",
    description: "Boundary values, equivalence cases, exceptions, alternate paths, or error conditions."
  },
  {
    id: "data-integration",
    label: "Data / Integration",
    description: "Inputs, outputs, payloads, events, APIs, files, systems, or dependencies."
  },
  {
    id: "compliance-policy",
    label: "Compliance / Policy",
    description:
      "Legal, security, privacy, audit, governance, regulatory, or internal policy considerations."
  }
] as const;

export type NoteCategoryId = (typeof noteCategories)[number]["id"];

export type DiagramNote = {
  id: string;
  categoryId: NoteCategoryId;
  title: string;
  body: string;
};

export type BriefPlacement = "below" | "right";

export type BriefSection = {
  categoryId: NoteCategoryId;
  label: string;
  markdown: string;
};

export function isNoteCategoryId(value: string): value is NoteCategoryId {
  return noteCategories.some((category) => category.id === value);
}

export function noteCategoryLabel(categoryId: NoteCategoryId) {
  return noteCategories.find((category) => category.id === categoryId)?.label ?? "General Note";
}

function normalizeHeading(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const categoryAliases = new Map<string, NoteCategoryId>(
  noteCategories.flatMap((category) => [[normalizeHeading(category.label), category.id] as const])
);

categoryAliases.set("compliance", "compliance-policy");
categoryAliases.set("policy", "compliance-policy");
categoryAliases.set("boundary", "boundary-edge-case");
categoryAliases.set("edge case", "boundary-edge-case");
categoryAliases.set("data", "data-integration");
categoryAliases.set("integration", "data-integration");

export function categoryIdFromHeading(heading: string): NoteCategoryId | null {
  return categoryAliases.get(normalizeHeading(heading)) ?? null;
}

export function parseBriefMarkdown(markdown: string): BriefSection[] {
  const sections: BriefSection[] = [];
  let current: BriefSection | null = null;
  const preamble: string[] = [];

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const heading = line.match(/^#\s+(.+?)\s*$/);
    const categoryId = heading ? categoryIdFromHeading(heading[1]) : null;

    if (categoryId) {
      if (current) {
        current.markdown = current.markdown.trim();
        sections.push(current);
      } else if (preamble.join("\n").trim()) {
        sections.push({
          categoryId: "general-note",
          label: noteCategoryLabel("general-note"),
          markdown: preamble.join("\n").trim()
        });
      }

      current = {
        categoryId,
        label: noteCategoryLabel(categoryId),
        markdown: ""
      };
      continue;
    }

    if (current) {
      current.markdown += `${line}\n`;
    } else {
      preamble.push(line);
    }
  }

  if (current) {
    current.markdown = current.markdown.trim();
    sections.push(current);
  } else if (preamble.join("\n").trim()) {
    sections.push({
      categoryId: "general-note",
      label: noteCategoryLabel("general-note"),
      markdown: preamble.join("\n").trim()
    });
  }

  return sections.filter((section) => section.markdown.trim() !== "");
}

export function notesToBriefMarkdown(notes: DiagramNote[]) {
  return notes
    .map((note) => {
      const body = note.body.trim();
      return [`# ${noteCategoryLabel(note.categoryId)}`, note.title ? `**${note.title}**` : "", body]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n");
}
