import { describe, expect, it } from "vitest";
import config from "./vite.config";

describe("vite config", () => {
  it("proxies API requests to the local Express server", () => {
    expect(config.server?.proxy?.["/api"]).toBe("http://127.0.0.1:3001");
  });
});
