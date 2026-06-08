const svgNamespace = "http://www.w3.org/2000/svg";

export function serializeSvgForDownload(svgText: string) {
  const document = new DOMParser().parseFromString(svgText, "text/html");
  const svg = document.querySelector("svg");

  if (!svg) {
    return svgText;
  }

  const serialized = new XMLSerializer().serializeToString(svg);

  if (/\sxmlns=/.test(serialized)) {
    return serialized;
  }

  return serialized.replace("<svg", `<svg xmlns="${svgNamespace}"`);
}
