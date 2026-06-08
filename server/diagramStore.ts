import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type DiagramSummary = {
  name: string;
  filename: string;
  sectionId: string | null;
};

export type DiagramRecord = DiagramSummary & {
  code: string;
};

export type SectionSummary = {
  id: string;
  name: string;
  createdAt: string;
};

export type SaveDiagramInput = {
  name: string;
  code: string;
};

export type DiagramStore = {
  listDiagrams(): Promise<DiagramSummary[]>;
  readDiagram(name: string): Promise<DiagramRecord>;
  saveDiagram(input: SaveDiagramInput): Promise<DiagramSummary>;
  renameDiagram(name: string, nextName: string): Promise<DiagramSummary>;
  deleteDiagram(name: string): Promise<void>;
  listSections(): Promise<SectionSummary[]>;
  createSection(name: string): Promise<SectionSummary>;
  renameSection(id: string, nextName: string): Promise<SectionSummary>;
  deleteSection(id: string): Promise<void>;
  reorderSections(sectionIds: string[]): Promise<SectionSummary[]>;
  assignDiagramToSection(name: string, sectionId: string | null): Promise<DiagramSummary>;
};

type SectionsMetadata = {
  sections: SectionSummary[];
  assignments: Record<string, string>;
};

const SECTIONS_METADATA_FILENAME = ".sections.json";

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

function toSummary(filename: string, sectionId: string | null = null): DiagramSummary {
  return {
    name: filename.replace(/\.mmd$/i, ""),
    filename,
    sectionId
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

  function resolveMetadataPath() {
    return path.join(root, SECTIONS_METADATA_FILENAME);
  }

  async function readMetadata(): Promise<SectionsMetadata> {
    await ensureRoot();

    try {
      const metadata = JSON.parse(await readFile(resolveMetadataPath(), "utf8")) as Partial<SectionsMetadata>;
      return {
        sections: Array.isArray(metadata.sections) ? metadata.sections : [],
        assignments:
          typeof metadata.assignments === "object" && metadata.assignments !== null
            ? metadata.assignments
            : {}
      };
    } catch (error) {
      if (typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT") {
        return { sections: [], assignments: {} };
      }

      throw error;
    }
  }

  async function writeMetadata(metadata: SectionsMetadata) {
    await ensureRoot();
    await writeFile(resolveMetadataPath(), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  }

  async function diagramExists(name: string) {
    const { filepath } = resolveDiagramPath(name);

    try {
      await readFile(filepath, "utf8");
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }

  function sectionExists(metadata: SectionsMetadata, sectionId: string) {
    return metadata.sections.some((section) => section.id === sectionId);
  }

  function createSectionId(name: string, createdAt: string) {
    return `${sanitizeDiagramName(name)}-${Date.parse(createdAt).toString(36)}`;
  }

  return {
    async listDiagrams() {
      await ensureRoot();
      const entries = await readdir(root, { withFileTypes: true });
      const metadata = await readMetadata();
      const validSectionIds = new Set(metadata.sections.map((section) => section.id));

      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".mmd"))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b))
        .map((filename) => {
          const name = filename.replace(/\.mmd$/i, "");
          const sectionId = metadata.assignments[name] ?? null;
          return toSummary(filename, sectionId && validSectionIds.has(sectionId) ? sectionId : null);
        });
    },

    async readDiagram(name: string) {
      await ensureRoot();
      const { filename, filepath } = resolveDiagramPath(name);
      const code = await readFile(filepath, "utf8");

      return {
        ...toSummary(filename, (await readMetadata()).assignments[filename.replace(/\.mmd$/i, "")] ?? null),
        code
      };
    },

    async saveDiagram(input: SaveDiagramInput) {
      await ensureRoot();
      const { filename, filepath } = resolveDiagramPath(input.name);
      await writeFile(filepath, input.code, "utf8");

      return toSummary(filename, (await readMetadata()).assignments[filename.replace(/\.mmd$/i, "")] ?? null);
    },

    async renameDiagram(name: string, nextName: string) {
      const trimmedName = nextName.trim();

      if (trimmedName === "") {
        throw Object.assign(new Error("diagram name is required"), { status: 400 });
      }

      await ensureRoot();
      const current = resolveDiagramPath(name);
      const next = resolveDiagramPath(trimmedName);
      const currentName = current.filename.replace(/\.mmd$/i, "");
      const nextDiagramName = next.filename.replace(/\.mmd$/i, "");
      await rename(current.filepath, next.filepath);

      const metadata = await readMetadata();
      const sectionId = metadata.assignments[currentName] ?? null;
      delete metadata.assignments[currentName];

      if (sectionId) {
        metadata.assignments[nextDiagramName] = sectionId;
      }

      await writeMetadata(metadata);
      return toSummary(next.filename, sectionId);
    },

    async deleteDiagram(name: string) {
      await ensureRoot();
      const { filepath } = resolveDiagramPath(name);
      await rm(filepath, { force: true });
      const metadata = await readMetadata();
      delete metadata.assignments[sanitizeDiagramName(name)];
      await writeMetadata(metadata);
    },

    async listSections() {
      const metadata = await readMetadata();
      return metadata.sections;
    },

    async createSection(name: string) {
      const trimmedName = name.trim();

      if (trimmedName === "") {
        throw Object.assign(new Error("section name is required"), { status: 400 });
      }

      const metadata = await readMetadata();
      const createdAt = new Date().toISOString();
      const section = {
        id: createSectionId(trimmedName, createdAt),
        name: trimmedName,
        createdAt
      };
      metadata.sections = [section, ...metadata.sections];
      await writeMetadata(metadata);
      return section;
    },

    async renameSection(id: string, nextName: string) {
      const trimmedName = nextName.trim();

      if (trimmedName === "") {
        throw Object.assign(new Error("section name is required"), { status: 400 });
      }

      const metadata = await readMetadata();
      const section = metadata.sections.find((candidate) => candidate.id === id);

      if (!section) {
        throw Object.assign(new Error("Section not found"), { status: 404 });
      }

      section.name = trimmedName;
      await writeMetadata(metadata);
      return section;
    },

    async deleteSection(id: string) {
      const metadata = await readMetadata();
      metadata.sections = metadata.sections.filter((section) => section.id !== id);

      for (const [diagramName, sectionId] of Object.entries(metadata.assignments)) {
        if (sectionId === id) {
          delete metadata.assignments[diagramName];
        }
      }

      await writeMetadata(metadata);
    },

    async reorderSections(sectionIds: string[]) {
      const metadata = await readMetadata();
      const sectionsById = new Map(metadata.sections.map((section) => [section.id, section]));
      const ordered = sectionIds
        .map((sectionId) => sectionsById.get(sectionId))
        .filter((section): section is SectionSummary => Boolean(section));
      const remaining = metadata.sections.filter((section) => !sectionIds.includes(section.id));

      metadata.sections = [...ordered, ...remaining];
      await writeMetadata(metadata);
      return metadata.sections;
    },

    async assignDiagramToSection(name: string, sectionId: string | null) {
      const metadata = await readMetadata();
      const diagramName = sanitizeDiagramName(name);

      if (!(await diagramExists(diagramName))) {
        throw Object.assign(new Error("Diagram not found"), { status: 404 });
      }

      if (sectionId !== null && !sectionExists(metadata, sectionId)) {
        throw Object.assign(new Error("Section not found"), { status: 404 });
      }

      if (sectionId === null) {
        delete metadata.assignments[diagramName];
      } else {
        metadata.assignments[diagramName] = sectionId;
      }

      await writeMetadata(metadata);
      return toSummary(toDiagramFilename(diagramName), sectionId);
    }
  };
}
