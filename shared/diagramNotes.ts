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

export function isNoteCategoryId(value: string): value is NoteCategoryId {
  return noteCategories.some((category) => category.id === value);
}

export function noteCategoryLabel(categoryId: NoteCategoryId) {
  return noteCategories.find((category) => category.id === categoryId)?.label ?? "General Note";
}
