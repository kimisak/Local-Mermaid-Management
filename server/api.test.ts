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
      .expect({ name: "system-flow", filename: "system-flow.mmd", sectionId: null });

    await request(app)
      .get("/api/diagrams")
      .expect(200)
      .expect("Content-Type", /json/)
      .expect([{ name: "system-flow", filename: "system-flow.mmd", sectionId: null }]);

    await request(app)
      .get("/api/diagrams/system-flow")
      .expect(200)
      .expect("Content-Type", /json/)
      .expect({
        name: "system-flow",
        filename: "system-flow.mmd",
        sectionId: null,
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

  it("manages sections and diagram assignments", async () => {
    const root = await createTempRoot();
    const app = createApp(root);

    await request(app)
      .post("/api/diagrams")
      .send({ name: "Checkout", code: "flowchart TD\n  A --> B" })
      .expect(200);

    const workflows = await request(app)
      .post("/api/sections")
      .send({ name: "Workflows" })
      .expect(200)
      .expect("Content-Type", /json/);
    const architecture = await request(app)
      .post("/api/sections")
      .send({ name: "Architecture" })
      .expect(200)
      .expect("Content-Type", /json/);

    await request(app)
      .get("/api/sections")
      .expect(200)
      .expect([architecture.body, workflows.body]);

    await request(app)
      .patch("/api/diagrams/checkout/section")
      .send({ sectionId: workflows.body.id })
      .expect(200)
      .expect({ name: "checkout", filename: "checkout.mmd", sectionId: workflows.body.id });

    await request(app)
      .put("/api/sections/order")
      .send({ sectionIds: [workflows.body.id, architecture.body.id] })
      .expect(200)
      .expect([workflows.body, architecture.body]);

    await request(app).delete(`/api/sections/${workflows.body.id}`).expect(204);
    await request(app)
      .get("/api/diagrams")
      .expect(200)
      .expect([{ name: "checkout", filename: "checkout.mmd", sectionId: null }]);
  });

  it("renames diagrams and sections", async () => {
    const root = await createTempRoot();
    const app = createApp(root);

    await request(app)
      .post("/api/diagrams")
      .send({ name: "Checkout", code: "flowchart TD\n  A --> B" })
      .expect(200);
    const section = await request(app).post("/api/sections").send({ name: "Workflows" }).expect(200);
    await request(app)
      .patch("/api/diagrams/checkout/section")
      .send({ sectionId: section.body.id })
      .expect(200);

    await request(app)
      .patch("/api/diagrams/checkout")
      .send({ name: "Checkout v2" })
      .expect(200)
      .expect({ name: "checkout-v2", filename: "checkout-v2.mmd", sectionId: section.body.id });

    await request(app)
      .get("/api/diagrams/checkout-v2")
      .expect(200)
      .expect({
        name: "checkout-v2",
        filename: "checkout-v2.mmd",
        sectionId: section.body.id,
        code: "flowchart TD\n  A --> B"
      });

    await request(app)
      .patch(`/api/sections/${section.body.id}`)
      .send({ name: "Renamed" })
      .expect(200)
      .expect({ ...section.body, name: "Renamed" });
  });

  it("reads and writes diagram notes", async () => {
    const root = await createTempRoot();
    const app = createApp(root);

    await request(app)
      .get("/api/diagrams/checkout/notes")
      .expect(200)
      .expect((response) => {
        expect(response.body).toBe("");
      });

    await request(app)
      .put("/api/diagrams/checkout/notes")
      .send({
        markdown: "# Business Rule\n1. Bookings after cutoff are rejected."
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toBe("# Business Rule\n1. Bookings after cutoff are rejected.");
      });
  });

  it("searches diagrams by title, code, and brief notes", async () => {
    const root = await createTempRoot();
    const app = createApp(root);

    await request(app)
      .post("/api/diagrams")
      .send({ name: "Checkout", code: "flowchart TD\n  A --> B" })
      .expect(200);
    await request(app)
      .put("/api/diagrams/checkout/notes")
      .send({ markdown: "# Pain Point\nManual booking creates duplicate entry." })
      .expect(200);

    await request(app)
      .get("/api/search?q=manual%20booking")
      .expect(200)
      .expect([
        {
          name: "checkout",
          filename: "checkout.mmd",
          sectionId: null,
          matches: ["brief"]
        }
      ]);
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
