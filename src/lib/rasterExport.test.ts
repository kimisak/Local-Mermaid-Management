import { afterEach, describe, expect, it, vi } from "vitest";
import { svgToRasterBlob } from "./rasterExport";

describe("svgToRasterBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders SVG to a raster blob with the requested mime type", async () => {
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      callback(new Blob(["raster"], { type }));
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        Object.defineProperty(canvas, "getContext", {
          configurable: true,
          value: () => ({ drawImage })
        });
        Object.defineProperty(canvas, "toBlob", {
          configurable: true,
          value: toBlob
        });
        return canvas;
      }

      return document.createElement(tagName);
    });

    class MockImage {
      width = 800;
      height = 450;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    vi.stubGlobal("Image", MockImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:svg");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const blob = await svgToRasterBlob("<svg></svg>", "image/webp", 0.92);

    expect(blob.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledOnce();
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.92);
  });
});
