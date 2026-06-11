import { Plus, Trash2 } from "lucide-react";
import { noteCategories, type DiagramNote, type NoteCategoryId } from "../../shared/diagramNotes";

type DiagramNotesEditorProps = {
  notes: DiagramNote[];
  onChange: (notes: DiagramNote[]) => void;
};

function createNote(): DiagramNote {
  return {
    id: crypto.randomUUID(),
    categoryId: "general-note",
    title: "",
    body: ""
  };
}

export function DiagramNotesEditor({ notes, onChange }: DiagramNotesEditorProps) {
  function updateNote(id: string, patch: Partial<DiagramNote>) {
    onChange(notes.map((note) => (note.id === id ? { ...note, ...patch } : note)));
  }

  return (
    <section className="diagramNotes" aria-label="Diagram notes">
      <div className="notesHeader">
        <div>
          <p className="eyebrow">Notes</p>
          <h2>Considerations</h2>
        </div>
        <button className="toolButton" type="button" onClick={() => onChange([...notes, createNote()])}>
          <Plus size={16} aria-hidden="true" />
          Add note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="mutedText">No notes yet.</p>
      ) : (
        <ul className="notesList">
          {notes.map((note) => (
            <li className="noteItem" key={note.id}>
              <div className="noteFields">
                <label>
                  <span>Category</span>
                  <select
                    value={note.categoryId}
                    title={
                      noteCategories.find((category) => category.id === note.categoryId)?.description
                    }
                    onChange={(event) =>
                      updateNote(note.id, { categoryId: event.target.value as NoteCategoryId })
                    }
                  >
                    {noteCategories.map((category) => (
                      <option key={category.id} value={category.id} title={category.description}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Title</span>
                  <input
                    value={note.title}
                    onChange={(event) => updateNote(note.id, { title: event.target.value })}
                    placeholder="Short title"
                  />
                </label>
              </div>
              <label className="noteBodyField">
                <span>Body</span>
                <textarea
                  value={note.body}
                  onChange={(event) => updateNote(note.id, { body: event.target.value })}
                  placeholder="Write the consideration, rule, assumption, or detail."
                />
              </label>
              <button
                className="iconButton subtle"
                type="button"
                onClick={() => onChange(notes.filter((candidate) => candidate.id !== note.id))}
                aria-label={`Delete note ${note.title || note.id}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
