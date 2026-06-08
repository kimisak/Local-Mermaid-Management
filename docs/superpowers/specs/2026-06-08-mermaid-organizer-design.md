# Mermaid Organizer Design

## Purpose

Build a local-only Mermaid.js code and diagram organizer for personal use. The app is not intended for hosting, scaling, accounts, sharing, or cloud storage. Its job is to let the user paste Mermaid code from external LLM output, render the diagram, explicitly save useful diagrams as repository files, organize saved diagrams through a sidebar, and export rendered diagrams as SVG.

## Product Layout

The app has three primary regions:

- Sidebar: lists saved diagrams from `diagrams/*.mmd`, supports selecting diagrams, creating a new unsaved diagram, and deleting saved diagrams.
- Code pane: shows the Mermaid source code in an editor with syntax highlighting where practical. It includes a copy-to-clipboard button for the current editor contents.
- Preview pane: renders the current Mermaid diagram. A toolbar above the preview includes an export-to-SVG action.

The main content area uses a split view: code on the left and rendered diagram on the right. The Save button lives in the main content toolbar, near the editor and preview controls.

## Storage Model

Saved diagrams are repository files. Each saved diagram is stored as one `.mmd` file in the `diagrams/` folder.

The app never stores a diagram automatically. Pasted or edited code remains in memory until the user presses Save. A new unsaved diagram can be edited without creating a file. On Save, the app prompts for or uses a diagram name, sanitizes it into a safe filename, and writes `diagrams/<name>.mmd`.

If the user has unsaved changes and selects another diagram, starts a new diagram, or deletes the current diagram, the app warns before discarding those changes.

## Paste And Editing Workflow

The primary workflow is:

1. Paste Mermaid code from an external LLM into the editor.
2. Render the preview automatically after edits.
3. Fix the code if Mermaid reports a render error.
4. Copy the current source code when needed using the editor copy button.
5. Save explicitly to create or update a `.mmd` file.
6. Use the sidebar to reload or delete saved diagrams.

The editor accepts raw Mermaid code. If pasted content includes Markdown fences such as ` ```mermaid ... ``` ` or ` ``` ... ``` `, the app strips the wrapper before rendering and saving.

## Rendering And Export

The app uses the current Mermaid npm package installed with `mermaid@latest` during implementation. Mermaid is initialized client-side in the React app.

The preview updates automatically after editor changes. If rendering fails, the preview pane shows a readable error message and does not save anything. Export to SVG downloads the currently rendered diagram as an `.svg` file. Export is disabled or reports a clear error when the current code cannot render.

## Architecture

Use Vite, React, and TypeScript for the frontend. Use CodeMirror for the code editor and Mermaid-friendly highlighting when available, with a practical fallback mode if not.

Use a small Express server for repository file operations. One local dev command starts both the Vite frontend and the Express API.

API endpoints:

- `GET /api/diagrams`: list saved `.mmd` files.
- `GET /api/diagrams/:name`: load one saved diagram.
- `POST /api/diagrams`: create or update a saved diagram.
- `DELETE /api/diagrams/:name`: delete one saved diagram.

The backend restricts all file operations to the `diagrams/` folder and sanitizes diagram names to avoid path traversal or accidental writes outside the repository diagram library.

## Out Of Scope

- User accounts.
- Database storage.
- Cloud sync.
- Hosting or deployment setup.
- Multi-user collaboration.
- Automatic saving.
- Non-Mermaid diagram formats.

## Testing And Verification

Automated checks should cover:

- Filename sanitization.
- Markdown fence stripping.
- API file operations for list, read, save, and delete.
- Unsaved-change state behavior where practical.

Manual browser verification should confirm:

- Mermaid code pasted into the editor renders in the preview.
- Mermaid errors are shown readably.
- Save writes a `.mmd` file under `diagrams/`.
- Loading a sidebar item reads the correct file.
- Delete removes the file and updates the sidebar.
- Copy-to-clipboard copies the current editor contents.
- Export downloads the rendered diagram as SVG.
