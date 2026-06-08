import { describe, expect, it } from "vitest";
import { insertTextAtSelection } from "./CodeEditor";

describe("insertTextAtSelection", () => {
  it("replaces the selected range with inserted text", () => {
    expect(
      insertTextAtSelection(
        "before\nPLACEHOLDER\nafter",
        "flowchart LR\n  X --> Y",
        "before\n".length,
        "before\nPLACEHOLDER".length
      )
    ).toBe("before\nflowchart LR\n  X --> Y\nafter");
  });
});
