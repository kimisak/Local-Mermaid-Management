import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { noteCategories, type NoteCategoryId } from "../../shared/diagramNotes";

type BriefEditorProps = {
  markdown: string;
  onChange: (markdown: string) => void;
};

export function BriefEditor({ markdown, onChange }: BriefEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<NoteCategoryId>(noteCategories[1].id);
  const selectedCategory = noteCategories.find((category) => category.id === selectedCategoryId) ?? noteCategories[0];

  function insertCategory() {
    const textarea = textareaRef.current;
    const insert = `${markdown.trim() ? "\n\n" : ""}# ${selectedCategory.label}\n`;

    if (!textarea) {
      onChange(`${markdown}${insert}`);
      return;
    }

    const nextMarkdown = `${markdown.slice(0, textarea.selectionStart)}${insert}${markdown.slice(
      textarea.selectionEnd
    )}`;
    onChange(nextMarkdown);
    requestAnimationFrame(() => {
      textarea.focus();
      const position = textarea.selectionStart + insert.length;
      textarea.setSelectionRange(position, position);
    });
  }

  return (
    <section className="editorPane" aria-label="Brief editor">
      <div className="paneHeader">
        <div>
          <p className="eyebrow">Brief</p>
          <h2>Context notes</h2>
        </div>
        <div className="briefTools">
          <select
            aria-label="Brief category"
            value={selectedCategoryId}
            title={selectedCategory.description}
            onChange={(event) => setSelectedCategoryId(event.target.value as NoteCategoryId)}
          >
            {noteCategories.map((category) => (
              <option key={category.id} value={category.id} title={category.description}>
                {category.label}
              </option>
            ))}
          </select>
          <button className="toolButton" type="button" onClick={insertCategory}>
            <Plus size={16} aria-hidden="true" />
            Insert category
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        aria-label="Brief markdown"
        className="editorFallback"
        value={markdown}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`# Business Rule
1. Short rule.
2. Another short rule.

# Constraint
- Short constraint.

# Compliance / Policy
> Short policy reference.`}
        spellCheck
      />
    </section>
  );
}
