import { ChevronDown, ChevronRight, FilePlus2, FolderPlus, Pencil, Trash2 } from "lucide-react";
import type { DiagramSummary, SectionSummary } from "../api/diagrams";

type SidebarProps = {
  diagrams: DiagramSummary[];
  sections: SectionSummary[];
  collapsedSectionIds: Set<string>;
  selectedName: string | null;
  loading: boolean;
  editMode: boolean;
  onCreate: () => void;
  onSelect: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
  onCreateSection: () => void;
  onRenameSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleSection: (sectionId: string) => void;
  onToggleEditMode: () => void;
  onMoveDiagramToSection: (name: string, sectionId: string | null) => void;
  onMoveSection: (sectionId: string, targetSectionId: string) => void;
};

export function Sidebar({
  diagrams,
  sections,
  collapsedSectionIds,
  selectedName,
  loading,
  editMode,
  onCreate,
  onSelect,
  onRename,
  onDelete,
  onCreateSection,
  onRenameSection,
  onDeleteSection,
  onToggleSection,
  onToggleEditMode,
  onMoveDiagramToSection,
  onMoveSection
}: SidebarProps) {
  const unsectionedDiagrams = diagrams.filter((diagram) => diagram.sectionId === null);

  function renderDiagram(diagram: DiagramSummary) {
    return (
      <li className="diagramListItem" key={diagram.name} aria-label={diagram.name}>
        <button
          className={`diagramButton ${selectedName === diagram.name ? "isActive" : ""}`}
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("application/x-mermaid-diagram", diagram.name);
          }}
          onDoubleClick={() => onRename(diagram.name)}
          onClick={() => onSelect(diagram.name)}
        >
          <span className="diagramName">{diagram.name}</span>
          <span className="diagramFilename">{diagram.filename}</span>
        </button>
        {editMode ? (
          <button
            className="iconButton subtle"
            type="button"
            onClick={() => onDelete(diagram.name)}
            aria-label={`Delete ${diagram.name}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        ) : null}
      </li>
    );
  }

  return (
    <aside className="sidebar" aria-label="Saved diagrams">
      <div className="sidebarHeader">
        <div>
          <p className="eyebrow">Mermaid</p>
          <h1>Diagrams</h1>
        </div>
        <div className="sidebarActions">
          <button className="iconButton" type="button" onClick={onCreateSection} aria-label="New section">
            <FolderPlus size={18} aria-hidden="true" />
          </button>
          <button className="iconButton" type="button" onClick={onCreate} aria-label="New diagram">
            <FilePlus2 size={18} aria-hidden="true" />
          </button>
          <button
            className={`iconButton ${editMode ? "isActive" : ""}`}
            type="button"
            onClick={onToggleEditMode}
            aria-label={editMode ? "Hide delete controls" : "Show delete controls"}
            aria-pressed={editMode}
          >
            <Pencil size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? <p className="mutedText">Loading saved diagrams...</p> : null}

      <ul className="diagramList" aria-label="Saved diagrams">
        <li
          className="sectionGroup"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const diagramName = event.dataTransfer.getData("application/x-mermaid-diagram");
            if (diagramName) {
              onMoveDiagramToSection(diagramName, null);
            }
          }}
        >
          <div className="sectionHeader">
            <span className="sectionTitle">Uncategorized</span>
            <span className="sectionCount">{unsectionedDiagrams.length}</span>
          </div>
          <ul className="sectionDiagramList">{unsectionedDiagrams.map(renderDiagram)}</ul>
        </li>

        {sections.map((section) => {
          const sectionDiagrams = diagrams.filter((diagram) => diagram.sectionId === section.id);
          const isCollapsed = collapsedSectionIds.has(section.id);

          return (
            <li
              className="sectionGroup"
              key={section.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-mermaid-section", section.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const diagramName = event.dataTransfer.getData("application/x-mermaid-diagram");
                const draggedSectionId = event.dataTransfer.getData("application/x-mermaid-section");

                if (diagramName) {
                  onMoveDiagramToSection(diagramName, section.id);
                } else if (draggedSectionId) {
                  onMoveSection(draggedSectionId, section.id);
                }
              }}
            >
              <div className="sectionHeader">
                <button
                  className="sectionToggle"
                  type="button"
                  onClick={() => onToggleSection(section.id)}
                  onDoubleClick={() => onRenameSection(section.id)}
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${section.name}`}
                >
                  {isCollapsed ? (
                    <ChevronRight size={16} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} aria-hidden="true" />
                  )}
                  <span className="sectionTitle">{section.name}</span>
                </button>
                <span className="sectionCount">{sectionDiagrams.length}</span>
                {editMode ? (
                  <button
                    className="iconButton subtle"
                    type="button"
                    onClick={() => onDeleteSection(section.id)}
                    aria-label={`Delete section ${section.name}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {!isCollapsed ? (
                <ul className="sectionDiagramList">{sectionDiagrams.map(renderDiagram)}</ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!loading && diagrams.length === 0 ? (
        <p className="mutedText">No saved diagrams yet.</p>
      ) : null}
    </aside>
  );
}
