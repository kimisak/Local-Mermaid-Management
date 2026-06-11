import { noteCategoryLabel, type DiagramNote } from "../../shared/diagramNotes";
import { serializeSvgForDownload } from "./svgExport";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const NOTE_WIDTH = 900;
const NOTE_MARGIN = 24;
const LINE_HEIGHT = 18;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value: string, maxLength = 96) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function svgDimensions(svgText: string) {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = parsed.querySelector("svg");
  const viewBox = svg?.getAttribute("viewBox")?.split(/\s+/).map(Number);

  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    return { width: Math.max(viewBox[2], NOTE_WIDTH), height: viewBox[3] };
  }

  const width = Number.parseFloat(svg?.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg?.getAttribute("height") ?? "");

  return {
    width: Number.isFinite(width) ? Math.max(width, NOTE_WIDTH) : NOTE_WIDTH,
    height: Number.isFinite(height) ? height : 500
  };
}

export function serializeSvgWithNotes(svgText: string, notes: DiagramNote[]) {
  const serializedSvg = serializeSvgForDownload(svgText);

  if (notes.length === 0) {
    return serializedSvg;
  }

  const { width, height } = svgDimensions(serializedSvg);
  let y = height + NOTE_MARGIN;
  const noteText: string[] = [
    `<text x="${NOTE_MARGIN}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700">Notes</text>`
  ];
  y += LINE_HEIGHT + 14;

  for (const note of notes) {
    const title = note.title.trim() || "Untitled";
    noteText.push(
      `<text x="${NOTE_MARGIN}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700">${escapeXml(
        `${noteCategoryLabel(note.categoryId)}: ${title}`
      )}</text>`
    );
    y += LINE_HEIGHT;

    for (const line of wrapText(note.body)) {
      noteText.push(
        `<text x="${NOTE_MARGIN}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="13">${escapeXml(
          line
        )}</text>`
      );
      y += LINE_HEIGHT;
    }

    y += 12;
  }

  return `<svg xmlns="${SVG_NAMESPACE}" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}"><svg x="0" y="0" width="${width}" height="${height}">${serializedSvg}</svg>${noteText.join(
    ""
  )}</svg>`;
}
