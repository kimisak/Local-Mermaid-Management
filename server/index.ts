import express, {
  type ErrorRequestHandler,
  type Request,
  type Response
} from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDiagramStore } from "./diagramStore";

const DEFAULT_PORT = 3001;
const LOCAL_HOST = "127.0.0.1";
const DEFAULT_DIAGRAMS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "diagrams"
);
const POST_BODY_LIMIT = "1mb";

function isDiagramInput(body: unknown): body is { name: string; code: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { name?: unknown }).name === "string" &&
    typeof (body as { code?: unknown }).code === "string"
  );
}

function isSectionInput(body: unknown): body is { name: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { name?: unknown }).name === "string"
  );
}

function isSectionAssignmentInput(body: unknown): body is { sectionId: string | null } {
  return (
    typeof body === "object" &&
    body !== null &&
    (typeof (body as { sectionId?: unknown }).sectionId === "string" ||
      (body as { sectionId?: unknown }).sectionId === null)
  );
}

function isSectionOrderInput(body: unknown): body is { sectionIds: string[] } {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { sectionIds?: unknown }).sectionIds) &&
    (body as { sectionIds: unknown[] }).sectionIds.every((sectionId) => typeof sectionId === "string")
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null;
}

function isMissingFileError(error: unknown) {
  return isNodeError(error) && error.code === "ENOENT";
}

export function createApp(diagramsRoot = DEFAULT_DIAGRAMS_ROOT) {
  const app = express();
  const store = createDiagramStore(diagramsRoot);

  app.use(express.json({ limit: POST_BODY_LIMIT }));

  app.get("/api/diagrams", async (_request: Request, response: Response) => {
    response.json(await store.listDiagrams());
  });

  app.get(
    "/api/diagrams/:name",
    async (request: Request<{ name: string }>, response: Response) => {
      try {
        response.json(await store.readDiagram(request.params.name));
      } catch (error) {
        if (isMissingFileError(error)) {
          response.status(404).json({ error: "Diagram not found" });
          return;
        }

        throw error;
      }
    }
  );

  app.post("/api/diagrams", async (request: Request, response: Response) => {
    if (!isDiagramInput(request.body)) {
      response.status(400).json({ error: "name and code must be strings" });
      return;
    }

    response.json(await store.saveDiagram(request.body));
  });

  app.patch(
    "/api/diagrams/:name/section",
    async (request: Request<{ name: string }>, response: Response) => {
      if (!isSectionAssignmentInput(request.body)) {
        response.status(400).json({ error: "sectionId must be a string or null" });
        return;
      }

      response.json(
        await store.assignDiagramToSection(request.params.name, request.body.sectionId)
      );
    }
  );

  app.delete(
    "/api/diagrams/:name",
    async (request: Request<{ name: string }>, response: Response) => {
      await store.deleteDiagram(request.params.name);
      response.status(204).send();
    }
  );

  app.get("/api/sections", async (_request: Request, response: Response) => {
    response.json(await store.listSections());
  });

  app.post("/api/sections", async (request: Request, response: Response) => {
    if (!isSectionInput(request.body)) {
      response.status(400).json({ error: "name must be a string" });
      return;
    }

    response.json(await store.createSection(request.body.name));
  });

  app.put("/api/sections/order", async (request: Request, response: Response) => {
    if (!isSectionOrderInput(request.body)) {
      response.status(400).json({ error: "sectionIds must be an array of strings" });
      return;
    }

    response.json(await store.reorderSections(request.body.sectionIds));
  });

  app.delete(
    "/api/sections/:id",
    async (request: Request<{ id: string }>, response: Response) => {
      await store.deleteSection(request.params.id);
      response.status(204).send();
    }
  );

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const status =
      typeof error?.status === "number"
        ? error.status
        : typeof error?.statusCode === "number"
          ? error.statusCode
          : 500;
    const message =
      status >= 500
        ? "Unexpected error"
        : error instanceof Error
          ? error.message
          : "Unexpected error";

    response.status(status).json({ error: message });
  };

  app.use(errorHandler);

  return app;
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  createApp().listen(port, LOCAL_HOST, () => {
    console.log(`API listening on http://127.0.0.1:${port}`);
  });
}
