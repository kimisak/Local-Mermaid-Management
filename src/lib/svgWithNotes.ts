import { parseBriefMarkdown, type BriefPlacement } from "../../shared/diagramNotes";
import { serializeSvgForDownload } from "./svgExport";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const STACKED_NOTE_WIDTH = 900;
const LEFT_NOTE_WIDTH = 420;
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

function textElement(x: number, y: number, value: string, options: { size?: number; weight?: number; style?: string } = {}) {
  const size = options.size ?? 13;
  const weight = options.weight ? ` font-weight="${options.weight}"` : "";
  const style = options.style ? ` font-style="${options.style}"` : "";

  return `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}"${weight}${style}>${escapeXml(
    value
  )}</text>`;
}

function renderWrappedText(target: string[], x: number, y: number, lines: string[], options = {}) {
  let nextY = y;

  for (const line of lines) {
    target.push(textElement(x, nextY, line, options));
    nextY += LINE_HEIGHT;
  }

  return nextY;
}

function renderMarkdownLine(target: string[], rawLine: string, x: number, y: number, maxLength: number) {
  if (!rawLine.trim()) {
    return y + LINE_HEIGHT / 2;
  }

  const bullet = rawLine.match(/^\s*[-*]\s+(.+)$/);
  if (bullet) {
    const lines = wrapText(bullet[1], maxLength - 4);
    target.push(textElement(x, y, "•"));
    return renderWrappedText(target, x + 18, y, lines);
  }

  const numbered = rawLine.match(/^\s*(\d+)[.)]\s+(.+)$/);
  if (numbered) {
    const marker = `${numbered[1]}.`;
    const lines = wrapText(numbered[2], maxLength - 6);
    target.push(textElement(x, y, marker));
    return renderWrappedText(target, x + 30, y, lines);
  }

  const quote = rawLine.match(/^\s*>\s?(.+)$/);
  if (quote) {
    const lines = wrapText(quote[1], maxLength - 4);
    const quoteHeight = lines.length * LINE_HEIGHT;
    target.push(
      `<rect x="${x}" y="${y - 13}" width="3" height="${quoteHeight}" fill="#8aa3a3" rx="1.5" />`
    );
    return renderWrappedText(target, x + 14, y, lines, { style: "italic" });
  }

  const subheading = rawLine.match(/^#{2,6}\s+(.+)$/);
  if (subheading) {
    return renderWrappedText(target, x, y, wrapText(subheading[1], maxLength), { weight: 700 });
  }

  return renderWrappedText(target, x, y, wrapText(rawLine, maxLength));
}

function renderMarkdownBlock(target: string[], markdown: string, x: number, y: number, maxLength: number) {
  let nextY = y;

  for (const line of markdown.split("\n")) {
    nextY = renderMarkdownLine(target, line, x, nextY, maxLength);
  }

  return nextY;
}

function svgDimensions(svgText: string) {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = parsed.querySelector("svg");
  const viewBox = svg?.getAttribute("viewBox")?.split(/\s+/).map(Number);

  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    return { width: viewBox[2], height: viewBox[3] };
  }

  const width = Number.parseFloat(svg?.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg?.getAttribute("height") ?? "");

  return {
    width: Number.isFinite(width) ? width : STACKED_NOTE_WIDTH,
    height: Number.isFinite(height) ? height : 500
  };
}

export function serializeSvgWithNotes(
  svgText: string,
  briefMarkdown: string,
  placement: BriefPlacement = "below"
) {
  const serializedSvg = serializeSvgForDownload(svgText);
  const sections = parseBriefMarkdown(briefMarkdown);

  if (sections.length === 0) {
    return serializedSvg;
  }

  const { width, height } = svgDimensions(serializedSvg);
  const noteWidth = placement === "left" ? LEFT_NOTE_WIDTH : STACKED_NOTE_WIDTH;
  const wrapLength = placement === "left" ? 48 : 96;
  const notesX = NOTE_MARGIN;
  let y = placement === "below" ? height + NOTE_MARGIN : NOTE_MARGIN;
  let noteHeight = y;
  const noteText: string[] = [textElement(notesX, y, "Brief", { size: 20, weight: 700 })];
  y += LINE_HEIGHT + 14;

  for (const section of sections) {
    noteText.push(textElement(notesX, y, section.label, { size: 15, weight: 700 }));
    y += LINE_HEIGHT;

    y = renderMarkdownBlock(noteText, section.markdown, notesX, y, wrapLength);
    y += 12;
  }
  noteHeight = y;

  const diagramX = placement === "left" ? noteWidth + NOTE_MARGIN * 2 : 0;
  const diagramY = placement === "above" ? noteHeight + NOTE_MARGIN : 0;
  const finalWidth = placement === "left" ? diagramX + width : Math.max(width, noteWidth);
  const finalHeight =
    placement === "left"
      ? Math.max(height, noteHeight + NOTE_MARGIN)
      : placement === "above"
        ? diagramY + height
        : noteHeight;

  return `<svg xmlns="${SVG_NAMESPACE}" width="${finalWidth}" height="${finalHeight}" viewBox="0 0 ${finalWidth} ${finalHeight}"><svg x="${diagramX}" y="${diagramY}" width="${width}" height="${height}">${serializedSvg}</svg>${noteText.join(
    ""
  )}</svg>`;
}
