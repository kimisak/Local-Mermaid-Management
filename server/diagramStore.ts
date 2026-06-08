import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type DiagramSummary = {
  name: string;
  filename: string;
};

export type DiagramRecord = DiagramSummary & {
  code: string;
};

export type SaveDiagramInput = {
  name: string;
  code: string;
};

export type DiagramStore = {
  listDiagrams(): Promise<DiagramSummary[]>;
  readDiagram(name: string): Promise<DiagramRecord>;
  saveDiagram(input: SaveDiagramInput): Promise<DiagramSummary>;
  deleteDiagram(name: string): Promise<void>;
};

export function sanitizeDiagramName(name: string): string {
  const sanitized = name
    .replace(/\.mmd$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized.slice(0, 80) || "diagram";
}

export function toDiagramFilename(name: string): string {
  return `${sanitizeDiagramName(name)}.mmd`;
}

function toSummary(filename: string): DiagramSummary {
  return {
    name: filename.replace(/\.mmd$/i, ""),
    filename
  };
}

export function createDiagramStore(root: string): DiagramStore {
  async function ensureRoot() {
    await mkdir(root, { recursive: true });
  }

  function resolveDiagramPath(name: string) {
    const filename = toDiagramFilename(name);
    return {
      filename,
      filepath: path.join(root, filename)
    };
  }

  return {
    async listDiagrams() {
      await ensureRoot();
      const entries = await readdir(root, { withFileTypes: true });

      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".mmd"))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b))
        .map(toSummary);
    },

    async readDiagram(name: string) {
      await ensureRoot();
      const { filename, filepath } = resolveDiagramPath(name);
      const code = await readFile(filepath, "utf8");

      return {
        ...toSummary(filename),
        code
      };
    },

    async saveDiagram(input: SaveDiagramInput) {
      await ensureRoot();
      const { filename, filepath } = resolveDiagramPath(input.name);
      await writeFile(filepath, input.code, "utf8");

      return toSummary(filename);
    },

    async deleteDiagram(name: string) {
      await ensureRoot();
      const { filepath } = resolveDiagramPath(name);
      await rm(filepath, { force: true });
    }
  };
}
