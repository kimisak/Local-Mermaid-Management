import { Copy } from "lucide-react";
import { useRef } from "react";
import { briefCategoryGuideMarkdown } from "../../shared/diagramNotes";

type BriefEditorProps = {
  markdown: string;
  onChange: (markdown: string) => void;
};

export function BriefEditor({ markdown, onChange }: BriefEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function copyCategoryGuide() {
    await navigator.clipboard.writeText(briefCategoryGuideMarkdown());
  }

  return (
    <section className="editorPane" aria-label="Brief editor">
      <div className="paneHeader">
        <div>
          <p className="eyebrow">Brief</p>
          <h2>Context notes</h2>
        </div>
        <div className="briefTools">
          <button className="toolButton" type="button" onClick={copyCategoryGuide}>
            <Copy size={16} aria-hidden="true" />
            Copy category guide
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
