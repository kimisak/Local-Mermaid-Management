import { describe, expect, it } from "vitest";
import { serializeSvgForDownload } from "./svgExport";

describe("serializeSvgForDownload", () => {
  it("serializes Mermaid HTML labels as XML-safe SVG", () => {
    const mermaidSvg =
      '<svg><foreignObject><div><p>First line<br>Second line</p></div></foreignObject></svg>';

    const serialized = serializeSvgForDownload(mermaidSvg);
    const parsed = new DOMParser().parseFromString(serialized, "image/svg+xml");

    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(serialized).toContain("<br");
    expect(serialized).toContain("/>");
  });
});
