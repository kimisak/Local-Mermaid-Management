import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDiagramStore,
  sanitizeDiagramName,
  toDiagramFilename
} from "./diagramStore";

async function createTempRoot() {
  return mkdtemp(path.join(tmpdir(), "mermaid-store-"));
}

describe("sanitizeDiagramName", () => {
  it("converts a human name into a safe base filename", () => {
    expect(sanitizeDiagramName("Customer Journey: Q2/2026")).toBe(
      "customer-journey-q2-2026"
    );
  });

  it("removes accents and trims replacement hyphens", () => {
    expect(sanitizeDiagramName("  Déjà Vu / Café!  ")).toBe("deja-vu-cafe");
  });

  it("falls back to diagram when the name has no safe characters", () => {
    expect(sanitizeDiagramName(" / ")).toBe("diagram");
  });

  it("caps sanitized base filenames to 80 characters", () => {
    const sanitized = sanitizeDiagramName("a".repeat(120));

    expect(sanitized).toHaveLength(80);
    expect(sanitized).toBe("a".repeat(80));
  });
});

describe("toDiagramFilename", () => {
  it("returns a sanitized mmd filename", () => {
    expect(toDiagramFilename("hello world")).toBe("hello-world.mmd");
    expect(toDiagramFilename("already.mmd")).toBe("already.mmd");
  });
});

describe("createDiagramStore", () => {
  it("saves UTF-8 Mermaid code, then lists, reads, and deletes the diagram", async () => {
    const root = await createTempRoot();
    const store = createDiagramStore(root);

    const saved = await store.saveDiagram({
      name: "System Flow",
      code: "flowchart TD\n  A[Blå] --> B[Grønn]"
    });

    expect(saved).toEqual({ name: "system-flow", filename: "system-flow.mmd" });
    expect(await store.listDiagrams()).toEqual([
      { name: "system-flow", filename: "system-flow.mmd" }
    ]);
    expect(await store.readDiagram("system-flow")).toEqual({
      name: "system-flow",
      filename: "system-flow.mmd",
      code: "flowchart TD\n  A[Blå] --> B[Grønn]"
    });

    await store.deleteDiagram("system-flow");
    await store.deleteDiagram("system-flow");

    expect(await store.listDiagrams()).toEqual([]);
    expect(await readdir(root)).toEqual([]);
  });

  it("creates the root directory when saving", async () => {
    const root = path.join(await createTempRoot(), "nested", "diagrams");
    const store = createDiagramStore(root);

    await store.saveDiagram({ name: "Created Later", code: "graph TD;A-->B" });

    expect(await readdir(root)).toEqual(["created-later.mmd"]);
  });

  it("only lists mmd files sorted by filename", async () => {
    const root = await createTempRoot();
    const store = createDiagramStore(root);

    await mkdir(path.join(root, "folder.mmd"));
    await writeFile(path.join(root, "notes.txt"), "not a diagram", "utf8");
    await writeFile(path.join(root, "zeta.mmd"), "graph TD;Z-->A", "utf8");
    await writeFile(path.join(root, "alpha.mmd"), "graph TD;A-->B", "utf8");

    expect(await store.listDiagrams()).toEqual([
      { name: "alpha", filename: "alpha.mmd" },
      { name: "zeta", filename: "zeta.mmd" }
    ]);
  });
});
