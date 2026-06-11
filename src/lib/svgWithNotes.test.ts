import { describe, expect, it } from "vitest";
import { serializeSvgWithNotes } from "./svgWithNotes";

describe("serializeSvgWithNotes", () => {
  it("appends notes as readable SVG text", () => {
    const exported = serializeSvgWithNotes(
      '<svg viewBox="0 0 100 50"><text>A</text></svg>',
      "# Business Rule\n1. Bookings after cutoff are rejected."
    );

    const parsed = new DOMParser().parseFromString(exported, "image/svg+xml");

    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(exported).toContain("<text");
    expect(exported).toContain("Business Rule");
    expect(exported).toContain("Bookings after cutoff are rejected.");
  });

  it("can place brief notes to the right of the diagram", () => {
    const exported = serializeSvgWithNotes(
      '<svg viewBox="0 0 100 50"><text>A</text></svg>',
      "# Constraint\n- Quantity is limited.",
      "right"
    );

    expect(exported).toContain('viewBox="0 0 1848 128"');
    expect(exported).toContain('x="924"');
    expect(exported).toContain("Constraint");
  });

  it("renders markdown bullets, numbered lists, and quotes as structured SVG text", () => {
    const exported = serializeSvgWithNotes(
      '<svg viewBox="0 0 100 50"><text>A</text></svg>',
      `# Forretningsregler
- Booking = kapasitetsreservasjon
1. Komplettering kreves
> Avbestilling etter frist`
    );

    expect(exported).toContain("Forretningsregler");
    expect(exported).toContain("•");
    expect(exported).toContain("Booking = kapasitetsreservasjon");
    expect(exported).toContain("1.");
    expect(exported).toContain("Komplettering kreves");
    expect(exported).toContain("<rect");
    expect(exported).toContain("Avbestilling etter frist");
    expect(exported).not.toContain("- Booking = kapasitetsreservasjon");
    expect(exported).not.toContain("&gt; Avbestilling etter frist");
  });

  it("can render brief sections as a horizontal category-content grid", () => {
    const exported = serializeSvgWithNotes(
      '<svg viewBox="0 0 100 50"><text>A</text></svg>',
      `# Forretningsregler
- Booking

# Mål
- Øke Flex`,
      "below",
      "horizontal"
    );

    expect(exported).toContain("Forretningsregler");
    expect(exported).toContain("Mål");
    expect(exported).toContain('x="24"');
    expect(exported).toContain('x="244"');
    expect(exported).toContain("<line");
  });
});
