import { Download, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";
import { downloadBlob, downloadTextFile } from "../lib/download";
import { svgToRasterBlob, type RasterMimeType } from "../lib/rasterExport";
import { serializeSvgForDownload } from "../lib/svgExport";

type PreviewPaneProps = {
  code: string;
  diagramName: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function exportFilename(diagramName: string | null, extension: string) {
  const base = diagramName?.trim() || "unsaved-diagram";
  return `${base.replace(/[^\w.-]+/g, "-")}.${extension}`;
}

function clampScale(value: number) {
  return Math.min(4, Math.max(0.25, Number(value.toFixed(2))));
}

export function PreviewPane({ code, diagramName }: PreviewPaneProps) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [renderedCode, setRenderedCode] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default"
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const source = code.trim();

    if (source === "") {
      setSvg(null);
      setRenderedCode(null);
      setRendering(false);
      setError(null);
      return;
    }

    setSvg(null);
    setRenderedCode(null);
    setRendering(true);
    setError(null);

    mermaid
      .render(`mermaid-preview-${id}-${Date.now()}`, source)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setSvg(result.svg);
        setRenderedCode(source);
        setRendering(false);
        setError(null);
      })
      .catch((renderError: unknown) => {
        if (cancelled) {
          return;
        }

        setSvg(null);
        setRenderedCode(null);
        setRendering(false);
        setError(errorMessage(renderError));
      });

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  function exportSvg() {
    if (svg && renderedCode === code.trim() && !rendering) {
      downloadTextFile(exportFilename(diagramName, "svg"), serializeSvgForDownload(svg));
    }
  }

  async function exportRaster(type: RasterMimeType, extension: "png" | "webp") {
    if (!svg || renderedCode !== code.trim() || rendering) {
      return;
    }

    const serializedSvg = serializeSvgForDownload(svg);
    const blob =
      type === "image/webp"
        ? await svgToRasterBlob(serializedSvg, type, 0.92)
        : await svgToRasterBlob(serializedSvg, type);
    downloadBlob(exportFilename(diagramName, extension), blob);
  }

  function exportPng() {
    void exportRaster("image/png", "png");
  }

  function exportWebp() {
    void exportRaster("image/webp", "webp");
  }

  function zoomBy(delta: number, anchor?: { x: number; y: number }) {
    const viewport = viewportRef.current;
    const zoomAnchor = anchor ?? {
      x: (viewport?.clientWidth ?? 0) / 2,
      y: (viewport?.clientHeight ?? 0) / 2
    };

    setScale((currentScale) => {
      const nextScale = clampScale(currentScale + delta);

      if (nextScale === currentScale) {
        return currentScale;
      }

      setPan((currentPan) => ({
        x: zoomAnchor.x - ((zoomAnchor.x - currentPan.x) / currentScale) * nextScale,
        y: zoomAnchor.y - ((zoomAnchor.y - currentPan.y) / currentScale) * nextScale
      }));

      return nextScale;
    });
  }

  function resetView() {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const start = dragStartRef.current;

      if (!start || event.pointerId !== start.pointerId) {
        return;
      }

      setPan({
        x: start.panX + event.clientX - start.clientX,
        y: start.panY + event.clientY - start.clientY
      });
    }

    function handlePointerUp(event: PointerEvent) {
      if (dragStartRef.current?.pointerId === event.pointerId) {
        dragStartRef.current = null;
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const canExport = Boolean(svg && renderedCode === code.trim() && !rendering);
  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;

  return (
    <section className="previewPane" aria-label="Diagram preview">
      <div className="paneHeader">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>Rendered diagram</h2>
        </div>
        <div className="previewTools">
          <button
            className="iconButton"
            type="button"
            onClick={() => zoomBy(0.2)}
            aria-label="Zoom in"
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <button
            className="iconButton"
            type="button"
            onClick={() => zoomBy(-0.2)}
            aria-label="Zoom out"
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <button className="iconButton" type="button" onClick={resetView} aria-label="Reset view">
            <RotateCcw size={16} aria-hidden="true" />
          </button>
          <button className="toolButton" type="button" onClick={exportSvg} disabled={!canExport}>
            <Download size={16} aria-hidden="true" />
            Export SVG
          </button>
          <button className="toolButton" type="button" onClick={exportPng} disabled={!canExport}>
            <Download size={16} aria-hidden="true" />
            Export PNG
          </button>
          <button className="toolButton" type="button" onClick={exportWebp} disabled={!canExport}>
            <Download size={16} aria-hidden="true" />
            Export WebP
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="previewSurface"
        aria-label="Diagram pan and zoom viewport"
        onWheel={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (!svg) {
            return;
          }

          const bounds = event.currentTarget.getBoundingClientRect();
          zoomBy(event.deltaY < 0 ? 0.1 : -0.1, {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top
          });
        }}
        onPointerDown={(event) => {
          if (!svg) {
            return;
          }

          event.preventDefault();
          dragStartRef.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            panX: pan.x,
            panY: pan.y
          };
        }}
      >
        {error ? (
          <div className="renderError" role="alert">
            <strong>Mermaid render error</strong>
            <pre>{error}</pre>
          </div>
        ) : null}
        {!error && svg ? (
          <div
            className="renderedDiagram"
            aria-label="Rendered Mermaid diagram"
            style={{ transform }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}
        {!error && !svg ? (
          <p className="previewPlaceholder">Paste or type Mermaid code to render a preview.</p>
        ) : null}
      </div>
    </section>
  );
}
