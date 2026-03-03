# LACE - Local Agent Compute Environment

Browser-based Python sandbox powered by Pyodide (CPython compiled to WebAssembly). All Python execution happens entirely in the browser via a Web Worker - no server-side execution.

## Architecture

**Frontend-only application** - the Express backend only serves static files. All computation happens client-side.

### Key Components
- `client/src/pages/lace.tsx` - Main page: split-pane layout with sidebar, editor, and terminal
- `client/src/hooks/use-pyodide.ts` - Hook managing the Pyodide Web Worker lifecycle, file operations, and package management
- `client/public/pyodide-worker.js` - Web Worker running Pyodide (loaded from CDN on-demand)
- `client/src/components/file-explorer.tsx` - Sidebar file tree for the in-memory `/workspace` filesystem
- `client/src/components/package-installer.tsx` - UI for installing Python packages via micropip
- `client/src/components/toolbar.tsx` - Control buttons (Init, Run, Stop, Clear, Save/Load Snapshot)
- `client/src/components/terminal-output.tsx` - Streaming stdout/stderr/system output display
- `client/src/components/shortcuts-help.tsx` - Keyboard shortcuts overlay

### How It Works
1. User clicks "Init" to load Pyodide (~20MB WASM) in a Web Worker
2. Code runs in the worker thread via `pyodide.runPythonAsync()` - UI stays responsive
3. stdout/stderr streams back to the terminal via `postMessage`
4. 10-second execution timeout with automatic worker termination
5. Workspace files live in Pyodide's in-memory filesystem at `/workspace`
6. Snapshots export all workspace files as JSON (array of `{path, base64_content}`)

### Features
- Monaco code editor with Python syntax highlighting
- Multi-file workspace with create/rename/delete support
- Package installer (micropip) for NumPy, Pandas, Matplotlib, etc.
- Keyboard shortcuts: Ctrl+Enter (run), Ctrl+S (save snapshot), ? (help)
- Resizable split-pane layout

## Design Tokens
- Background: #000000, Cards: #1A1A1A, Primary: lime green (hsl 88 50.4% 52.5%), Accent: purple (hsl 253.5 100% 75%)
- Fonts: Space Grotesk (UI), Geist Mono (code/terminal)
- Dark mode only

## Dependencies
- `@monaco-editor/react` - Code editor
- `react-resizable-panels` - Split pane layout
- Pyodide v0.24.1 (loaded from CDN at runtime)
