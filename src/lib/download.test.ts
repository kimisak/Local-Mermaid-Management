import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "./download";

describe("downloadTextFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("revokes the object URL after the click tick", () => {
    vi.useFakeTimers();

    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadTextFile("diagram.mmd", "flowchart TD\n  A --> B");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
