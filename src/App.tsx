import { Save } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import "./App.css";
import {
  assignDiagramToSection,
  createSection,
  deleteDiagram,
  deleteSection,
  listDiagrams,
  listSections,
  loadDiagram,
  reorderSections,
  saveDiagram,
  type DiagramSummary,
  type SectionSummary
} from "./api/diagrams";
import { CodeEditor } from "./components/CodeEditor";
import { PreviewPane } from "./components/PreviewPane";
import { Sidebar } from "./components/Sidebar";
import { getMermaidFrontmatterTitle } from "./lib/mermaidInput";

const DISCARD_MESSAGE = "Discard unsaved changes?";
const SPLIT_STORAGE_KEY = "mermaid-organizer.editorPanePercent";
const COLLAPSED_SECTIONS_STORAGE_KEY = "mermaid-organizer.collapsedSections";
const DEFAULT_EDITOR_PANE_PERCENT = 50;
const MIN_EDITOR_PANE_PERCENT = 28;
const MAX_EDITOR_PANE_PERCENT = 68;

function clampEditorPanePercent(value: number) {
  return Math.min(MAX_EDITOR_PANE_PERCENT, Math.max(MIN_EDITOR_PANE_PERCENT, Math.round(value)));
}

function initialEditorPanePercent() {
  const stored = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
  return Number.isFinite(stored)
    ? clampEditorPanePercent(stored)
    : DEFAULT_EDITOR_PANE_PERCENT;
}

export default function App() {
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(COLLAPSED_SECTIONS_STORAGE_KEY) ?? "[]") as string[])
  );
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editorPanePercent, setEditorPanePercent] = useState(initialEditorPanePercent);
  const [resizingSplit, setResizingSplit] = useState(false);
  const operationGenerationRef = useRef(0);
  const splitViewRef = useRef<HTMLDivElement | null>(null);

  const isDirty = code !== savedCode;
  const frontmatterTitle = useMemo(() => getMermaidFrontmatterTitle(code), [code]);
  const statusLabel = useMemo(() => {
    if (isDirty) {
      return selectedName ? "Unsaved changes" : "Unsaved new diagram";
    }

    return selectedName ? "Saved" : "New unsaved diagram";
  }, [isDirty, selectedName]);

  const refreshList = useCallback(async () => {
    setLoadingList(true);

    try {
      const [nextDiagrams, nextSections] = await Promise.all([listDiagrams(), listSections()]);
      setDiagrams(nextDiagrams);
      setSections(nextSections);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!resizingSplit) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const bounds = splitViewRef.current?.getBoundingClientRect();

      if (!bounds || bounds.width === 0) {
        return;
      }

      const nextPercent = clampEditorPanePercent(
        ((event.clientX - bounds.left) / bounds.width) * 100
      );
      setEditorPanePercent(nextPercent);
      localStorage.setItem(SPLIT_STORAGE_KEY, String(nextPercent));
    }

    function handlePointerUp() {
      setResizingSplit(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [resizingSplit]);

  function confirmDiscardIfDirty() {
    return !isDirty || window.confirm(DISCARD_MESSAGE);
  }

  function beginOperation() {
    operationGenerationRef.current += 1;
    return operationGenerationRef.current;
  }

  function isCurrentOperation(operationGeneration: number) {
    return operationGenerationRef.current === operationGeneration;
  }

  async function handleSelect(name: string) {
    if (name === selectedName || !confirmDiscardIfDirty()) {
      return;
    }

    const operationGeneration = beginOperation();
    setBusy(true);
    setMessage(null);

    try {
      const diagram = await loadDiagram(name);
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      setSelectedName(diagram.name);
      setCode(diagram.code);
      setSavedCode(diagram.code);
    } catch (error) {
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (isCurrentOperation(operationGeneration)) {
        setBusy(false);
      }
    }
  }

  function handleCreate() {
    if (!confirmDiscardIfDirty()) {
      return;
    }

    beginOperation();
    setSelectedName(null);
    setCode("");
    setSavedCode("");
    setBusy(false);
    setMessage(null);
  }

  function persistCollapsedSections(nextCollapsedSectionIds: Set<string>) {
    setCollapsedSectionIds(nextCollapsedSectionIds);
    localStorage.setItem(
      COLLAPSED_SECTIONS_STORAGE_KEY,
      JSON.stringify([...nextCollapsedSectionIds])
    );
  }

  function handleToggleSection(sectionId: string) {
    const nextCollapsedSectionIds = new Set(collapsedSectionIds);

    if (nextCollapsedSectionIds.has(sectionId)) {
      nextCollapsedSectionIds.delete(sectionId);
    } else {
      nextCollapsedSectionIds.add(sectionId);
    }

    persistCollapsedSections(nextCollapsedSectionIds);
  }

  async function handleCreateSection() {
    const name = window.prompt("Section name", "")?.trim() ?? "";

    if (name === "") {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const section = await createSection(name);
      setSections((currentSections) => [section, ...currentSections]);
      setMessage(`Created "${section.name}".`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    const section = sections.find((candidate) => candidate.id === sectionId);

    if (!section || !window.confirm(`Delete section "${section.name}"? Diagrams will move to Uncategorized.`)) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await deleteSection(sectionId);
      setSections((currentSections) => currentSections.filter((candidate) => candidate.id !== sectionId));
      setDiagrams((currentDiagrams) =>
        currentDiagrams.map((diagram) =>
          diagram.sectionId === sectionId ? { ...diagram, sectionId: null } : diagram
        )
      );
      const nextCollapsedSectionIds = new Set(collapsedSectionIds);
      nextCollapsedSectionIds.delete(sectionId);
      persistCollapsedSections(nextCollapsedSectionIds);
      setMessage(`Deleted section "${section.name}".`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveDiagramToSection(name: string, sectionId: string | null) {
    setMessage(null);

    try {
      const moved = await assignDiagramToSection(name, sectionId);
      setDiagrams((currentDiagrams) =>
        currentDiagrams.map((diagram) => (diagram.name === moved.name ? moved : diagram))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleMoveSection(sectionId: string, targetSectionId: string) {
    if (sectionId === targetSectionId) {
      return;
    }

    const currentSections = sections;
    const draggedSection = currentSections.find((section) => section.id === sectionId);
    const targetIndex = currentSections.findIndex((section) => section.id === targetSectionId);

    if (!draggedSection || targetIndex === -1) {
      return;
    }

    const nextSections = currentSections.filter((section) => section.id !== sectionId);
    nextSections.splice(targetIndex, 0, draggedSection);
    setSections(nextSections);

    try {
      setSections(await reorderSections(nextSections.map((section) => section.id)));
    } catch (error) {
      setSections(currentSections);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSave() {
    const trimmedCode = code.trim();
    const defaultName = frontmatterTitle ?? "";
    const name = selectedName ?? window.prompt("Diagram name", defaultName)?.trim() ?? "";

    if (name === "" || trimmedCode === "") {
      setMessage("Add a diagram name and Mermaid code before saving.");
      return;
    }

    const operationGeneration = beginOperation();
    setBusy(true);
    setMessage(null);
    const savedCodeSnapshot = code;

    try {
      const saved = await saveDiagram({ name, code: savedCodeSnapshot });
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      setSelectedName(saved.name);
      setSavedCode(savedCodeSnapshot);
      await refreshList();
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      setMessage("Saved.");
    } catch (error) {
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (isCurrentOperation(operationGeneration)) {
        setBusy(false);
      }
    }
  }

  async function handleDelete(name: string) {
    if (selectedName === name && !confirmDiscardIfDirty()) {
      return;
    }

    if (!window.confirm(`Delete "${name}"?`)) {
      return;
    }

    const operationGeneration = beginOperation();
    setBusy(true);
    setMessage(null);

    try {
      await deleteDiagram(name);
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      if (selectedName === name) {
        setSelectedName(null);
        setCode("");
        setSavedCode("");
      }

      await refreshList();
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      setMessage(`Deleted "${name}".`);
    } catch (error) {
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (isCurrentOperation(operationGeneration)) {
        setBusy(false);
      }
    }
  }

  return (
    <main className="appShell">
      <Sidebar
        diagrams={diagrams}
        sections={sections}
        collapsedSectionIds={collapsedSectionIds}
        selectedName={selectedName}
        loading={loadingList}
        onCreate={handleCreate}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onCreateSection={handleCreateSection}
        onDeleteSection={handleDeleteSection}
        onToggleSection={handleToggleSection}
        onMoveDiagramToSection={handleMoveDiagramToSection}
        onMoveSection={handleMoveSection}
      />

      <section className="workspace" aria-label="Workspace">
        <header className="toolbar">
          <div className="documentTitle">
            <span className="documentName">{selectedName ?? "Untitled diagram"}</span>
            <span className={`statusPill ${isDirty ? "isDirty" : ""}`}>{statusLabel}</span>
          </div>
          <button className="primaryButton" type="button" onClick={handleSave} disabled={busy}>
            <Save size={16} aria-hidden="true" />
            Save
          </button>
        </header>

        {message ? (
          <div className="appMessage" role="status">
            {message}
          </div>
        ) : null}

        <div
          ref={splitViewRef}
          className={`splitView ${resizingSplit ? "isResizing" : ""}`}
          aria-label="Editor and preview split view"
          style={
            {
              "--editor-pane-percent": `${editorPanePercent}%`
            } as CSSProperties
          }
        >
          <CodeEditor code={code} onChange={setCode} />
          <button
            className="splitHandle"
            type="button"
            role="separator"
            aria-label="Resize editor and preview"
            aria-orientation="vertical"
            onPointerDown={(event) => {
              event.preventDefault();
              setResizingSplit(true);
            }}
          />
          <PreviewPane code={code} diagramName={selectedName ?? frontmatterTitle} />
        </div>
      </section>
    </main>
  );
}
