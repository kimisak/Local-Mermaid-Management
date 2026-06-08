import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import mermaid from "mermaid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  deleteDiagram,
  listDiagrams,
  loadDiagram,
  saveDiagram
} from "./api/diagrams";
import { downloadBlob, downloadTextFile } from "./lib/download";
import { svgToRasterBlob } from "./lib/rasterExport";

vi.mock("./api/diagrams", () => ({
  listDiagrams: vi.fn(),
  loadDiagram: vi.fn(),
  saveDiagram: vi.fn(),
  deleteDiagram: vi.fn()
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, code: string) => ({
      svg: `<svg data-testid="mock-svg"><text>${code}</text></svg>`,
      diagramType: "flowchart"
    }))
  }
}));

vi.mock("./lib/download", () => ({
  downloadBlob: vi.fn(),
  downloadTextFile: vi.fn()
}));

vi.mock("./lib/rasterExport", () => ({
  svgToRasterBlob: vi.fn()
}));

const mockedListDiagrams = vi.mocked(listDiagrams);
const mockedLoadDiagram = vi.mocked(loadDiagram);
const mockedSaveDiagram = vi.mocked(saveDiagram);
const mockedDeleteDiagram = vi.mocked(deleteDiagram);
const mockedMermaidRender = vi.mocked(mermaid.render);
const mockedDownloadBlob = vi.mocked(downloadBlob);
const mockedDownloadTextFile = vi.mocked(downloadTextFile);
const mockedSvgToRasterBlob = vi.mocked(svgToRasterBlob);

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedMermaidRender.mockImplementation(async (_id: string, code: string) => ({
      svg: `<svg data-testid="mock-svg"><text>${code}</text></svg>`,
      diagramType: "flowchart"
    }));
    mockedSvgToRasterBlob.mockResolvedValue(new Blob(["raster"], { type: "image/png" }));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
    mockedListDiagrams.mockResolvedValue([
      { name: "Checkout flow", filename: "Checkout flow.mmd" },
      { name: "Roadmap", filename: "Roadmap.mmd" }
    ]);
    mockedLoadDiagram.mockImplementation(async (name: string) => ({
      name,
      filename: `${name}.mmd`,
      code: name === "Checkout flow" ? "flowchart TD\n  A --> B" : "graph LR\n  C --> D"
    }));
    mockedSaveDiagram.mockResolvedValue({
      name: "Checkout flow",
      filename: "Checkout flow.mmd"
    });
    mockedDeleteDiagram.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads a sidebar diagram into the editor", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Checkout flow/i })
    );

    expect(mockedLoadDiagram).toHaveBeenCalledWith("Checkout flow");
    expect(await screen.findByRole("textbox", { name: /mermaid code/i })).toHaveValue(
      "flowchart TD\n  A --> B"
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("strips Markdown Mermaid fences from pasted LLM output", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: /mermaid code/i });
    await userEvent.click(editor);
    await userEvent.paste("```mermaid\nflowchart LR\n  X --> Y\n```");

    expect(editor).toHaveValue("flowchart LR\n  X --> Y");
    expect(screen.getByText("Unsaved new diagram")).toBeInTheDocument();
  });

  it("inserts stripped Mermaid fences at the selected editor range", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: /mermaid code/i });
    fireEvent.change(editor, { target: { value: "before\nPLACEHOLDER\nafter" } });
    (editor as HTMLTextAreaElement).setSelectionRange("before\n".length, "before\nPLACEHOLDER".length);

    fireEvent.paste(editor, {
      clipboardData: {
        getData: () => "```mermaid\nflowchart LR\n  X --> Y\n```"
      }
    });

    expect(editor).toHaveValue("before\nflowchart LR\n  X --> Y\nafter");
  });

  it("saves explicitly through the API", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Checkout flow/i })
    );
    const editor = screen.getByRole("textbox", { name: /mermaid code/i });
    await userEvent.clear(editor);
    await userEvent.type(editor, "flowchart TD\n  Changed --> Preview");

    expect(mockedSaveDiagram).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(mockedSaveDiagram).toHaveBeenCalledWith({
      name: "Checkout flow",
      code: "flowchart TD\n  Changed --> Preview"
    });
  });

  it("uses frontmatter title as the default save name for a new diagram", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Architecture Overview");
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: /mermaid code/i });
    fireEvent.change(editor, {
      target: {
        value: "---\ntitle: Architecture Overview\n---\nflowchart TD\n  A --> B"
      }
    });
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(promptSpy).toHaveBeenCalledWith("Diagram name", "Architecture Overview");
    expect(mockedSaveDiagram).toHaveBeenCalledWith({
      name: "Architecture Overview",
      code: "---\ntitle: Architecture Overview\n---\nflowchart TD\n  A --> B"
    });
  });

  it("keeps a newer new diagram when an earlier unsaved save resolves later", async () => {
    let resolveSave: (value: Awaited<ReturnType<typeof saveDiagram>>) => void;
    mockedSaveDiagram.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );
    vi.spyOn(window, "prompt").mockReturnValue("Delayed save");

    render(<App />);

    const editor = await screen.findByRole("textbox", { name: /mermaid code/i });
    await userEvent.type(editor, "flowchart TD\n  Old --> Save");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await userEvent.click(screen.getByRole("button", { name: /new diagram/i }));

    expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue("");
    expect(screen.getByText("New unsaved diagram")).toBeInTheDocument();

    await act(async () => {
      resolveSave!({
        name: "Delayed save",
        filename: "Delayed save.mmd"
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue("")
    );
    expect(screen.getByText("New unsaved diagram")).toBeInTheDocument();
    expect(screen.getByText("Untitled diagram")).toBeInTheDocument();
    expect(screen.queryByText("Delayed save")).not.toBeInTheDocument();
  });

  it("keeps a new diagram when deleting the current diagram resolves after navigating away", async () => {
    let resolveDelete: () => void;
    mockedDeleteDiagram.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
    );

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /^Checkout flow/i }));
    expect(await screen.findByRole("textbox", { name: /mermaid code/i })).toHaveValue(
      "flowchart TD\n  A --> B"
    );

    await userEvent.click(screen.getByRole("button", { name: /delete Checkout flow/i }));
    await waitFor(() => expect(mockedDeleteDiagram).toHaveBeenCalledWith("Checkout flow"));
    await userEvent.click(screen.getByRole("button", { name: /new diagram/i }));

    expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue("");
    expect(screen.getByText("New unsaved diagram")).toBeInTheDocument();

    await act(async () => {
      resolveDelete!();
    });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue("")
    );
    expect(screen.getByText("New unsaved diagram")).toBeInTheDocument();
    expect(screen.getByText("Untitled diagram")).toBeInTheDocument();
    expect(screen.queryByText('Deleted "Checkout flow".')).not.toBeInTheDocument();
  });

  it("ignores stale save success when refresh resolves after navigating away", async () => {
    let resolveRefresh: (value: Awaited<ReturnType<typeof listDiagrams>>) => void;
    mockedListDiagrams
      .mockResolvedValueOnce([
        { name: "Checkout flow", filename: "Checkout flow.mmd" },
        { name: "Roadmap", filename: "Roadmap.mmd" }
      ])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          })
      );
    mockedSaveDiagram.mockResolvedValue({
      name: "Checkout flow",
      filename: "Checkout flow.mmd"
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /^Checkout flow/i }));
    const editor = screen.getByRole("textbox", { name: /mermaid code/i });
    await userEvent.clear(editor);
    await userEvent.type(editor, "flowchart TD\n  Changed --> Preview");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(mockedListDiagrams).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole("button", { name: /new diagram/i }));

    expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue("");
    expect(screen.getByText("New unsaved diagram")).toBeInTheDocument();

    await act(async () => {
      resolveRefresh!([{ name: "Checkout flow", filename: "Checkout flow.mmd" }]);
    });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue("")
    );
    expect(screen.getByText("New unsaved diagram")).toBeInTheDocument();
    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
  });

  it("warns before switching away from dirty edits", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Checkout flow/i })
    );
    await userEvent.type(screen.getByRole("textbox", { name: /mermaid code/i }), "\n  B --> C");
    await userEvent.click(screen.getByRole("button", { name: /^Roadmap/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockedLoadDiagram).not.toHaveBeenCalledWith("Roadmap");
    expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue(
      "flowchart TD\n  A --> B\n  B --> C"
    );
  });

  it("keeps the latest selected diagram when earlier loads resolve later", async () => {
    let resolveCheckout: (value: Awaited<ReturnType<typeof loadDiagram>>) => void;
    let resolveRoadmap: (value: Awaited<ReturnType<typeof loadDiagram>>) => void;
    mockedLoadDiagram.mockImplementation((name: string) => {
      if (name === "Checkout flow") {
        return new Promise((resolve) => {
          resolveCheckout = resolve;
        });
      }

      return new Promise((resolve) => {
        resolveRoadmap = resolve;
      });
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /^Checkout flow/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Roadmap/i }));

    await act(async () => {
      resolveRoadmap!({
        name: "Roadmap",
        filename: "Roadmap.mmd",
        code: "graph LR\n  C --> D"
      });
    });
    expect(await screen.findByRole("textbox", { name: /mermaid code/i })).toHaveValue(
      "graph LR\n  C --> D"
    );

    await act(async () => {
      resolveCheckout!({
        name: "Checkout flow",
        filename: "Checkout flow.mmd",
        code: "flowchart TD\n  A --> B"
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue(
        "graph LR\n  C --> D"
      )
    );
    expect(screen.getByRole("button", { name: /^RoadmapRoadmap\.mmd$/i })).toHaveClass(
      "isActive"
    );
  });

  it("keeps a new empty diagram when a pending selected diagram load resolves later", async () => {
    let resolveCheckout: (value: Awaited<ReturnType<typeof loadDiagram>>) => void;
    mockedLoadDiagram.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheckout = resolve;
        })
    );

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /^Checkout flow/i }));
    await userEvent.click(screen.getByRole("button", { name: /new diagram/i }));

    expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue("");
    expect(screen.getByText("New unsaved diagram")).toBeInTheDocument();

    await act(async () => {
      resolveCheckout!({
        name: "Checkout flow",
        filename: "Checkout flow.mmd",
        code: "flowchart TD\n  A --> B"
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue("")
    );
    expect(screen.getByText("New unsaved diagram")).toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("keeps the current editor when a deleted diagram load resolves later", async () => {
    let resolveCheckout: (value: Awaited<ReturnType<typeof loadDiagram>>) => void;
    mockedLoadDiagram.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheckout = resolve;
        })
    );

    render(<App />);

    const editor = await screen.findByRole("textbox", { name: /mermaid code/i });
    await userEvent.type(editor, "flowchart LR\n  Current --> Draft");
    await userEvent.click(screen.getByRole("button", { name: /^Checkout flow/i }));
    await userEvent.click(screen.getByRole("button", { name: /delete Checkout flow/i }));

    await waitFor(() => expect(mockedDeleteDiagram).toHaveBeenCalledWith("Checkout flow"));

    await act(async () => {
      resolveCheckout!({
        name: "Checkout flow",
        filename: "Checkout flow.mmd",
        code: "flowchart TD\n  Deleted --> Loaded"
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /mermaid code/i })).toHaveValue(
        "flowchart LR\n  Current --> Draft"
      )
    );
    expect(screen.getByText("Untitled diagram")).toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Checkout flowCheckout flow\.mmd$/i })).not.toHaveClass(
      "isActive"
    );
  });

  it("does not warn about discarding edits when deleting an unrelated dirty diagram", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockImplementation((message) => {
      return String(message).startsWith("Delete");
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /^Checkout flow/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /mermaid code/i }), "\n  B --> C");

    const roadmapItem = screen.getByRole("listitem", { name: /Roadmap/ });
    await userEvent.click(
      within(roadmapItem).getByRole("button", { name: /delete Roadmap/i })
    );

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Delete "Roadmap"?');
    expect(mockedDeleteDiagram).toHaveBeenCalledWith("Roadmap");
  });

  it("disables SVG export while a newer render is pending", async () => {
    const renderResolvers: Array<(value: { svg: string; diagramType: string }) => void> = [];
    mockedMermaidRender.mockImplementation(
      (_id: string, code: string) =>
        new Promise((resolve) => {
          renderResolvers.push(() =>
            resolve({ svg: `<svg><text>${code}</text></svg>`, diagramType: "flowchart" })
          );
        })
    );
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: /mermaid code/i });
    const exportButton = screen.getByRole("button", { name: /export svg/i });
    fireEvent.change(editor, { target: { value: "flowchart TD\n  A --> B" } });
    await waitFor(() => expect(renderResolvers).toHaveLength(1));
    renderResolvers[0]({ svg: "<svg><text>first</text></svg>", diagramType: "flowchart" });
    await waitFor(() => expect(exportButton).toBeEnabled());

    fireEvent.change(editor, { target: { value: "flowchart TD\n  A --> C" } });

    expect(exportButton).toBeDisabled();
    await userEvent.click(exportButton);
    expect(mockedDownloadTextFile).not.toHaveBeenCalled();
  });

  it("exports XML-safe SVG when Mermaid returns HTML-style labels", async () => {
    mockedMermaidRender.mockResolvedValue({
      svg: '<svg><foreignObject><div><p>First line<br>Second line</p></div></foreignObject></svg>',
      diagramType: "flowchart"
    });
    render(<App />);

    await userEvent.type(
      await screen.findByRole("textbox", { name: /mermaid code/i }),
      "flowchart TD\n  A --> B"
    );
    await userEvent.click(await screen.findByRole("button", { name: /export svg/i }));

    const exported = mockedDownloadTextFile.mock.calls.at(-1)?.[1] ?? "";
    const parsed = new DOMParser().parseFromString(exported, "image/svg+xml");

    expect(parsed.querySelector("parsererror")).toBeNull();
  });

  it("uses frontmatter title as the SVG filename for an unsaved diagram", async () => {
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: /mermaid code/i }), {
      target: {
        value: "---\ntitle: Architecture Overview\n---\nflowchart TD\n  A --> B"
      }
    });
    await userEvent.click(await screen.findByRole("button", { name: /export svg/i }));

    expect(mockedDownloadTextFile).toHaveBeenLastCalledWith(
      "Architecture-Overview.svg",
      expect.any(String)
    );
  });

  it("exports the rendered diagram as PNG", async () => {
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: /mermaid code/i }), {
      target: { value: "---\ntitle: Export Flow\n---\nflowchart TD\n  A --> B" }
    });
    const pngBlob = new Blob(["png"], { type: "image/png" });
    mockedSvgToRasterBlob.mockResolvedValueOnce(pngBlob);

    await userEvent.click(await screen.findByRole("button", { name: /export png/i }));

    expect(mockedSvgToRasterBlob).toHaveBeenCalledWith(expect.stringContaining("<svg"), "image/png");
    expect(mockedDownloadBlob).toHaveBeenCalledWith("Export-Flow.png", pngBlob);
  });

  it("exports the rendered diagram as WebP", async () => {
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: /mermaid code/i }), {
      target: { value: "flowchart TD\n  A --> B" }
    });
    const webpBlob = new Blob(["webp"], { type: "image/webp" });
    mockedSvgToRasterBlob.mockResolvedValueOnce(webpBlob);

    await userEvent.click(await screen.findByRole("button", { name: /export webp/i }));

    expect(mockedSvgToRasterBlob).toHaveBeenCalledWith(
      expect.stringContaining("<svg"),
      "image/webp",
      0.92
    );
    expect(mockedDownloadBlob).toHaveBeenCalledWith("unsaved-diagram.webp", webpBlob);
  });

  it("resizes the editor and preview panes by dragging the split handle", async () => {
    render(<App />);

    const splitView = await screen.findByLabelText("Editor and preview split view");
    const resizeHandle = screen.getByRole("separator", { name: /resize editor and preview/i });

    Object.defineProperty(splitView, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, width: 1000 })
    });

    fireEvent.pointerDown(resizeHandle, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 320, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(splitView).toHaveStyle({ "--editor-pane-percent": "32%" });
    expect(localStorage.getItem("mermaid-organizer.editorPanePercent")).toBe("32");
  });

  it("restores the saved split width from local storage", async () => {
    localStorage.setItem("mermaid-organizer.editorPanePercent", "34");

    render(<App />);

    expect(await screen.findByLabelText("Editor and preview split view")).toHaveStyle({
      "--editor-pane-percent": "34%"
    });
  });

  it("zooms and pans the rendered diagram without changing exported SVG", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: /mermaid code/i });
    fireEvent.change(editor, { target: { value: "flowchart TD\n  A --> B" } });

    const viewport = await screen.findByLabelText("Diagram pan and zoom viewport");
    const zoomIn = screen.getByRole("button", { name: /zoom in/i });
    const exportButton = await screen.findByRole("button", { name: /export svg/i });

    await userEvent.click(zoomIn);
    expect(viewport.firstElementChild).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.2)"
    });

    fireEvent.pointerDown(viewport, { clientX: 100, clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(window, { clientX: 135, clientY: 120, pointerId: 2 });
    fireEvent.pointerUp(window, { pointerId: 2 });

    expect(viewport.firstElementChild).toHaveStyle({
      transform: "translate(35px, 20px) scale(1.2)"
    });

    await userEvent.click(exportButton);

    expect(mockedDownloadTextFile).toHaveBeenCalledWith(
      "unsaved-diagram.svg",
      expect.stringContaining("<svg")
    );
    expect(mockedDownloadTextFile.mock.calls.at(-1)?.[1]).not.toContain("scale(1.2)");
  });

  it("prevents native text selection when dragging the rendered diagram", async () => {
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: /mermaid code/i }), {
      target: { value: "flowchart TD\n  A --> B" }
    });

    const viewport = await screen.findByLabelText("Diagram pan and zoom viewport");
    const pointerDown = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      pointerId: 3
    });

    viewport.dispatchEvent(pointerDown);

    expect(pointerDown.defaultPrevented).toBe(true);
  });

  it("keeps diagram wheel zoom from scrolling the page", async () => {
    const pageWheelListener = vi.fn();
    document.addEventListener("wheel", pageWheelListener);

    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: /mermaid code/i }), {
      target: { value: "flowchart TD\n  A --> B" }
    });
    await screen.findByTestId("mock-svg");

    const viewport = await screen.findByLabelText("Diagram pan and zoom viewport");
    fireEvent.wheel(viewport, {
      clientX: 200,
      clientY: 150,
      deltaY: 100
    });

    expect(pageWheelListener).not.toHaveBeenCalled();

    document.removeEventListener("wheel", pageWheelListener);
  });

  it("anchors toolbar zoom around the center of the preview viewport", async () => {
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: /mermaid code/i }), {
      target: { value: "flowchart TD\n  A --> B" }
    });

    const viewport = await screen.findByLabelText("Diagram pan and zoom viewport");
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 1000 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 600 });

    await userEvent.click(screen.getByRole("button", { name: /zoom in/i }));

    expect(viewport.firstElementChild).toHaveStyle({
      transform: "translate(-100px, -60px) scale(1.2)"
    });
  });

  it("asks for confirmation and deletes through the API", async () => {
    render(<App />);

    const checkoutItem = await screen.findByRole("listitem", {
      name: /Checkout flow/
    });
    await userEvent.click(
      within(checkoutItem).getByRole("button", { name: /delete Checkout flow/i })
    );

    expect(window.confirm).toHaveBeenCalled();
    expect(mockedDeleteDiagram).toHaveBeenCalledWith("Checkout flow");
    await waitFor(() => expect(mockedListDiagrams).toHaveBeenCalledTimes(2));
  });
});
