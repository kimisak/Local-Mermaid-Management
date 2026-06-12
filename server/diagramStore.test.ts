import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
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

    expect(saved).toEqual({ name: "system-flow", filename: "system-flow.mmd", sectionId: null });
    expect(await store.listDiagrams()).toEqual([
      { name: "system-flow", filename: "system-flow.mmd", sectionId: null }
    ]);
    expect(await store.readDiagram("system-flow")).toEqual({
      name: "system-flow",
      filename: "system-flow.mmd",
      sectionId: null,
      code: "flowchart TD\n  A[Blå] --> B[Grønn]"
    });

    await store.deleteDiagram("system-flow");
    await store.deleteDiagram("system-flow");

    expect(await store.listDiagrams()).toEqual([]);
    expect(await readdir(root)).toEqual([".sections.json"]);
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
      { name: "alpha", filename: "alpha.mmd", sectionId: null },
      { name: "zeta", filename: "zeta.mmd", sectionId: null }
    ]);
  });

  it("stores sections and diagram assignments in local metadata", async () => {
    const root = await createTempRoot();
    const store = createDiagramStore(root);

    await store.saveDiagram({ name: "Checkout", code: "flowchart TD\n  A --> B" });
    const first = await store.createSection("Workflows");
    const second = await store.createSection("Architecture");

    expect(await store.listSections()).toEqual([second, first]);

    await store.assignDiagramToSection("checkout", first.id);
    expect(await store.listDiagrams()).toEqual([
      { name: "checkout", filename: "checkout.mmd", sectionId: first.id }
    ]);

    await store.deleteSection(first.id);
    expect(await store.listDiagrams()).toEqual([
      { name: "checkout", filename: "checkout.mmd", sectionId: null }
    ]);

    const metadata = JSON.parse(await readFile(path.join(root, ".sections.json"), "utf8"));
    expect(metadata.sections).toEqual([second]);
    expect(metadata.assignments).toEqual({});
  });

  it("renames a diagram and preserves its section assignment", async () => {
    const root = await createTempRoot();
    const store = createDiagramStore(root);

    await store.saveDiagram({ name: "Checkout", code: "flowchart TD\n  A --> B" });
    const section = await store.createSection("Workflows");
    await store.assignDiagramToSection("checkout", section.id);

    const renamed = await store.renameDiagram("checkout", "Checkout v2");

    expect(renamed).toEqual({
      name: "checkout-v2",
      filename: "checkout-v2.mmd",
      sectionId: section.id
    });
    expect(await store.readDiagram("checkout-v2")).toEqual({
      ...renamed,
      code: "flowchart TD\n  A --> B"
    });
    await expect(store.readDiagram("checkout")).rejects.toMatchObject({ code: "ENOENT" });

    const metadata = JSON.parse(await readFile(path.join(root, ".sections.json"), "utf8"));
    expect(metadata.assignments).toEqual({ "checkout-v2": section.id });
  });

  it("stores notes next to a diagram and moves them when the diagram is renamed", async () => {
    const root = await createTempRoot();
    const store = createDiagramStore(root);

    await store.saveDiagram({ name: "Checkout", code: "flowchart TD\n  A --> B" });
    await store.saveDiagramNotes(
      "checkout",
      "# Business Rule\n1. Bookings after cutoff are rejected."
    );

    expect(await store.readDiagramNotes("checkout")).toBe(
      "# Business Rule\n1. Bookings after cutoff are rejected."
    );

    await store.renameDiagram("checkout", "Checkout v2");

    expect(await store.readDiagramNotes("checkout-v2")).toContain("Bookings after cutoff");
    await expect(readFile(path.join(root, "checkout.notes.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("searches diagrams by title, code, and brief notes", async () => {
    const root = await createTempRoot();
    const store = createDiagramStore(root);

    await store.saveDiagram({ name: "Checkout", code: "flowchart TD\n  A --> B" });
    await store.saveDiagram({ name: "Settlement", code: "sequenceDiagram\n  Customer->>Ledger: Post invoice" });
    await store.saveDiagram({ name: "Roadmap", code: "flowchart LR\n  Idea --> Build" });
    await store.saveDiagramNotes("checkout", "# Pain Point\nManual booking creates duplicate entry.");

    expect(await store.searchDiagrams("checkout")).toEqual([
      {
        name: "checkout",
        filename: "checkout.mmd",
        sectionId: null,
        matches: ["title"]
      }
    ]);
    expect(await store.searchDiagrams("ledger")).toEqual([
      {
        name: "settlement",
        filename: "settlement.mmd",
        sectionId: null,
        matches: ["code"]
      }
    ]);
    expect(await store.searchDiagrams("manual booking")).toEqual([
      {
        name: "checkout",
        filename: "checkout.mmd",
        sectionId: null,
        matches: ["brief"]
      }
    ]);
    expect(await store.searchDiagrams("   ")).toEqual([]);
  });

  it("renames a section", async () => {
    const root = await createTempRoot();
    const store = createDiagramStore(root);
    const section = await store.createSection("Old name");

    const renamed = await store.renameSection(section.id, "New name");

    expect(renamed).toEqual({ ...section, name: "New name" });
    expect(await store.listSections()).toEqual([renamed]);
  });

  it("reorders sections", async () => {
    const root = await createTempRoot();
    const store = createDiagramStore(root);

    const first = await store.createSection("First");
    const second = await store.createSection("Second");
    const third = await store.createSection("Third");

    await store.reorderSections([first.id, third.id, second.id]);

    expect(await store.listSections()).toEqual([first, third, second]);
  });
});
