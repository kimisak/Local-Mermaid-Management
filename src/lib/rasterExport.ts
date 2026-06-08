export type RasterMimeType = "image/png" | "image/webp";

export async function svgToRasterBlob(
  svgText: string,
  type: RasterMimeType,
  quality?: number
): Promise<Blob> {
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not load SVG for raster export"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.width || 1;
    canvas.height = image.height || 1;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas rendering is not available");
    }

    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error("Could not export raster image"));
        },
        type,
        quality
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
