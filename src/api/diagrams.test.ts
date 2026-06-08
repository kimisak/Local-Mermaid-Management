import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteDiagram,
  listDiagrams,
  loadDiagram,
  saveDiagram
} from "./diagrams";

describe("diagram API errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps list diagram network failures with operation context", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    await expect(listDiagrams()).rejects.toThrow(
      "Failed to list diagrams: fetch failed"
    );
  });

  it("wraps load diagram invalid JSON failures with operation context", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(loadDiagram("broken")).rejects.toThrow(
      "Failed to load diagram \"broken\":"
    );
  });

  it("wraps save diagram network failures with operation context", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connection reset"));

    await expect(
      saveDiagram({ name: "draft", code: "flowchart TD\n  A --> B" })
    ).rejects.toThrow("Failed to save diagram \"draft\": connection reset");
  });

  it("wraps delete diagram network failures with operation context", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(deleteDiagram("stale")).rejects.toThrow(
      "Failed to delete diagram \"stale\": offline"
    );
  });
});
