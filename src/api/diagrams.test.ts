import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assignDiagramToSection,
  createSection,
  deleteDiagram,
  deleteSection,
  listDiagrams,
  listSections,
  loadDiagram,
  loadDiagramNotes,
  renameDiagram,
  renameSection,
  reorderSections,
  saveDiagram,
  saveDiagramNotes
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

  it("wraps section API network failures with operation context", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(listSections()).rejects.toThrow("Failed to list sections: offline");
    await expect(createSection("Workflows")).rejects.toThrow(
      "Failed to create section \"Workflows\": offline"
    );
    await expect(deleteSection("workflows")).rejects.toThrow("Failed to delete section: offline");
    await expect(reorderSections(["workflows"])).rejects.toThrow(
      "Failed to reorder sections: offline"
    );
  });

  it("wraps move diagram failures with operation context", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(assignDiagramToSection("checkout", "workflows")).rejects.toThrow(
      "Failed to move diagram \"checkout\": offline"
    );
  });

  it("wraps diagram notes failures with operation context", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(loadDiagramNotes("checkout")).rejects.toThrow(
      "Failed to load notes for \"checkout\": offline"
    );
    await expect(saveDiagramNotes("checkout", "")).rejects.toThrow(
      "Failed to save notes for \"checkout\": offline"
    );
  });

  it("wraps rename failures with operation context", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(renameDiagram("checkout", "checkout v2")).rejects.toThrow(
      "Failed to rename diagram \"checkout\": offline"
    );
    await expect(renameSection("workflows", "Workflows v2")).rejects.toThrow(
      "Failed to rename section: offline"
    );
  });
});
