import { markdown } from "@codemirror/lang-markdown";
import type { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { Copy } from "lucide-react";
import { useRef } from "react";
import type React from "react";
import { stripMermaidFences } from "../lib/mermaidInput";

type CodeEditorProps = {
  code: string;
  onChange: (value: string) => void;
};

export function insertTextAtSelection(
  value: string,
  insert: string,
  from: number,
  to: number
): string {
  return `${value.slice(0, from)}${insert}${value.slice(to)}`;
}

export function CodeEditor({ code, onChange }: CodeEditorProps) {
  const editorViewRef = useRef<EditorView | null>(null);

  function handlePaste(event: React.ClipboardEvent) {
    const pasted = event.clipboardData.getData("text");
    const stripped = stripMermaidFences(pasted);

    if (stripped !== pasted) {
      event.preventDefault();
      const target = event.target;

      if (target instanceof HTMLTextAreaElement) {
        const selectionStart = target.selectionStart;
        const selectionEnd = target.selectionEnd;
        onChange(insertTextAtSelection(code, stripped, selectionStart, selectionEnd));
        return;
      }

      const view = editorViewRef.current;
      if (!view) {
        onChange(stripped);
        return;
      }

      const selection = view.state.selection.main;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: stripped },
        selection: { anchor: selection.from + stripped.length },
        scrollIntoView: true
      });
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code);
  }

  return (
    <section className="editorPane" aria-label="Code editor">
      <div className="paneHeader">
        <div>
          <p className="eyebrow">Code</p>
          <h2>Mermaid source</h2>
        </div>
        <button className="toolButton" type="button" onClick={copyCode}>
          <Copy size={16} aria-hidden="true" />
          Copy code
        </button>
      </div>

      {import.meta.env.MODE === "test" ? (
        <textarea
          aria-label="Mermaid code"
          className="editorFallback"
          value={code}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          spellCheck={false}
        />
      ) : (
        <div className="codeMirrorShell" onPasteCapture={handlePaste}>
          <CodeMirror
            value={code}
            height="100%"
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              highlightActiveLine: true
            }}
            extensions={[markdown()]}
            aria-label="Mermaid code"
            onChange={onChange}
            onCreateEditor={(view) => {
              editorViewRef.current = view;
            }}
            theme="light"
          />
        </div>
      )}
    </section>
  );
}
