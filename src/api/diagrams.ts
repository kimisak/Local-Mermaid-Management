export type DiagramSummary = {
  name: string;
  filename: string;
};

export type DiagramRecord = DiagramSummary & {
  code: string;
};

type SaveDiagramInput = {
  name: string;
  code: string;
};

async function readErrorMessage(response: Response) {
  const fallback = `${response.status} ${response.statusText}`.trim();

  try {
    const body = (await response.clone().json()) as { error?: unknown };

    if (typeof body.error === "string" && body.error.trim() !== "") {
      return `${body.error} (${fallback})`;
    }
  } catch {
    const text = await response.text().catch(() => "");

    if (text.trim() !== "") {
      return `${text.trim()} (${fallback})`;
    }
  }

  return fallback;
}

async function fetchJson<T>(url: string, init: RequestInit, action: string) {
  try {
    const response = await fetch(url, init);

    if (!response.ok) {
      throw new Error(`${action}: ${await readErrorMessage(response)}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    throw wrapApiError(action, error);
  }
}

function wrapApiError(action: string, error: unknown) {
  if (error instanceof Error && error.message.startsWith(`${action}:`)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${action}: ${message}`);
}

function diagramUrl(name: string) {
  return `/api/diagrams/${encodeURIComponent(name)}`;
}

export function listDiagrams() {
  return fetchJson<DiagramSummary[]>(
    "/api/diagrams",
    { method: "GET" },
    "Failed to list diagrams"
  );
}

export function loadDiagram(name: string) {
  return fetchJson<DiagramRecord>(
    diagramUrl(name),
    { method: "GET" },
    `Failed to load diagram "${name}"`
  );
}

export function saveDiagram(input: SaveDiagramInput) {
  return fetchJson<DiagramSummary>(
    "/api/diagrams",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    },
    `Failed to save diagram "${input.name}"`
  );
}

export async function deleteDiagram(name: string) {
  const action = `Failed to delete diagram "${name}"`;

  try {
    const response = await fetch(diagramUrl(name), { method: "DELETE" });

    if (!response.ok) {
      throw new Error(`${action}: ${await readErrorMessage(response)}`);
    }
  } catch (error) {
    throw wrapApiError(action, error);
  }
}
