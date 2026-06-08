import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./index";

async function createTempRoot() {
  return mkdtemp(path.join(tmpdir(), "mermaid-api-"));
}

describe("diagram API", () => {
  it("saves, lists, reads, and deletes diagrams", async () => {
    const root = await createTempRoot();
    const app = createApp(root);

    await request(app)
      .post("/api/diagrams")
      .send({ name: "System Flow", code: "flowchart TD\n  A --> B" })
      .expect(200)
      .expect("Content-Type", /json/)
      .expect({ name: "system-flow", filename: "system-flow.mmd" });

    await request(app)
      .get("/api/diagrams")
      .expect(200)
      .expect("Content-Type", /json/)
      .expect([{ name: "system-flow", filename: "system-flow.mmd" }]);

    await request(app)
      .get("/api/diagrams/system-flow")
      .expect(200)
      .expect("Content-Type", /json/)
      .expect({
        name: "system-flow",
        filename: "system-flow.mmd",
        code: "flowchart TD\n  A --> B"
      });

    await request(app).delete("/api/diagrams/system-flow").expect(204);

    await request(app).get("/api/diagrams").expect(200).expect([]);
  });

  it("returns 400 JSON errors when POST body fields are missing or not strings", async () => {
    const root = await createTempRoot();
    const app = createApp(root);

    await request(app)
      .post("/api/diagrams")
      .send({ name: "Missing Code" })
      .expect(400)
      .expect("Content-Type", /json/)
      .expect({ error: "name and code must be strings" });

    await request(app)
      .post("/api/diagrams")
      .send({ name: 42, code: "flowchart TD\n  A --> B" })
      .expect(400)
      .expect("Content-Type", /json/)
      .expect({ error: "name and code must be strings" });
  });

  it("returns 404 JSON when reading a missing diagram", async () => {
    const root = await createTempRoot();
    const app = createApp(root);

    await request(app)
      .get("/api/diagrams/missing-diagram")
      .expect(404)
      .expect("Content-Type", /json/)
      .expect({ error: "Diagram not found" });
  });

  it("returns sanitized JSON for unexpected filesystem errors", async () => {
    const root = path.join(await createTempRoot(), "not-a-directory");
    await writeFile(root, "file blocks directory creation", "utf8");
    const app = createApp(root);

    const response = await request(app)
      .get("/api/diagrams")
      .expect(500)
      .expect("Content-Type", /json/);

    expect(response.body).toEqual({ error: "Unexpected error" });
    expect(JSON.stringify(response.body)).not.toContain(root);
  });
});
