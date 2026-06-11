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

  it("can place brief notes to the left of the diagram", () => {
    const exported = serializeSvgWithNotes(
      '<svg viewBox="0 0 100 50"><text>A</text></svg>',
      "# Constraint\n- Quantity is limited.",
      "left"
    );

    expect(exported).toContain('viewBox="0 0 1848 128"');
    expect(exported).toContain('<svg x="948" y="0"');
    expect(exported).toContain('x="24"');
    expect(exported).toContain("Constraint");
  });

  it("can place brief notes above the diagram", () => {
    const exported = serializeSvgWithNotes(
      '<svg viewBox="0 0 100 50"><text>A</text></svg>',
      "# Constraint\n- Quantity is limited.",
      "above"
    );

    expect(exported).toContain('viewBox="0 0 900 178"');
    expect(exported).toContain('<svg x="0" y="128"');
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

});
