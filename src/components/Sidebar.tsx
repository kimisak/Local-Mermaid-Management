import { FilePlus2, Trash2 } from "lucide-react";
import type { DiagramSummary } from "../api/diagrams";

type SidebarProps = {
  diagrams: DiagramSummary[];
  selectedName: string | null;
  loading: boolean;
  onCreate: () => void;
  onSelect: (name: string) => void;
  onDelete: (name: string) => void;
};

export function Sidebar({
  diagrams,
  selectedName,
  loading,
  onCreate,
  onSelect,
  onDelete
}: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Saved diagrams">
      <div className="sidebarHeader">
        <div>
          <p className="eyebrow">Mermaid</p>
          <h1>Diagrams</h1>
        </div>
        <button className="iconButton" type="button" onClick={onCreate} aria-label="New diagram">
          <FilePlus2 size={18} aria-hidden="true" />
        </button>
      </div>

      {loading ? <p className="mutedText">Loading saved diagrams...</p> : null}

      <ul className="diagramList" aria-label="Saved diagrams">
        {diagrams.map((diagram) => (
          <li
            className="diagramListItem"
            key={diagram.name}
            aria-label={diagram.name}
          >
            <button
              className={`diagramButton ${selectedName === diagram.name ? "isActive" : ""}`}
              type="button"
              onClick={() => onSelect(diagram.name)}
            >
              <span className="diagramName">{diagram.name}</span>
              <span className="diagramFilename">{diagram.filename}</span>
            </button>
            <button
              className="iconButton subtle"
              type="button"
              onClick={() => onDelete(diagram.name)}
              aria-label={`Delete ${diagram.name}`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {!loading && diagrams.length === 0 ? (
        <p className="mutedText">No saved diagrams yet.</p>
      ) : null}
    </aside>
  );
}
