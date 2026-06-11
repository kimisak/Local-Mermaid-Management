import { describe, expect, it } from "vitest";
import { serializeSvgWithNotes } from "./svgWithNotes";

describe("serializeSvgWithNotes", () => {
  it("appends notes as readable SVG text", () => {
    const exported = serializeSvgWithNotes('<svg viewBox="0 0 100 50"><text>A</text></svg>', [
      {
        id: "note-1",
        categoryId: "business-rule",
        title: "Cutoff",
        body: "Bookings after cutoff are rejected."
      }
    ]);

    const parsed = new DOMParser().parseFromString(exported, "image/svg+xml");

    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(exported).toContain("<text");
    expect(exported).toContain("Business Rule: Cutoff");
    expect(exported).toContain("Bookings after cutoff are rejected.");
  });
});
