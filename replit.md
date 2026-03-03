# LACE - Local Agent Compute Environment

Browser-based Python sandbox powered by Pyodide (CPython compiled to WebAssembly). All Python execution happens entirely in the browser via a Web Worker - no server-side execution.

## Architecture

**Frontend-only application** - the Express backend only serves static files. All computation happens client-side.

### Key Components
- `client/src/pages/lace.tsx` - Main page: split-pane layout with environment tabs, sidebar, editor, and terminal
- `client/src/hooks/use-environment-manager.ts` - Hook managing multiple independent Pyodide environments, each with its own Web Worker
- `client/src/hooks/use-pyodide.ts` - Type definitions (RuntimeStatus, TerminalLine, InstalledPackage) shared across the app
- `client/src/lib/persistence.ts` - IndexedDB persistence layer for files and environment metadata
- `client/public/pyodide-worker.js` - Web Worker running Pyodide (loaded from CDN on-demand)
- `client/src/components/environment-switcher.tsx` - Tab bar for creating, switching, renaming, and removing environments
- `client/src/components/file-explorer.tsx` - Sidebar file tree for the in-memory `/workspace` filesystem
- `client/src/components/package-installer.tsx` - UI for installing Python packages via micropip
- `client/src/components/toolbar.tsx` - Control buttons (Init, Run, Stop, Clear, Save/Load Snapshot, Persist toggle) with environment context
- `client/src/components/terminal-output.tsx` - Streaming stdout/stderr/system output display
- `client/src/components/storage-manager.tsx` - Modal panel to view/manage IndexedDB stored files per environment
- `client/src/components/shortcuts-help.tsx` - Keyboard shortcuts overlay

### Multi-Environment Architecture
```
useEnvironmentManager hook
   ├─ Environment 1: { id, name, worker, status, files, lines, packages, color, persistent }
   ├─ Environment 2: { id, name, worker, status, files, lines, packages, color, persistent }
   └─ Environment N: ...
```

Each environment is fully independent:
- Own Web Worker (separate thread) with its own Pyodide instance
- Own `/workspace` filesystem (isolated in-memory)
- Own terminal output, installed packages, and runtime status
- Environments can run code in parallel (each in its own worker thread)
- UI shows one "active" environment at a time, but all run independently in the background

### Persistence Architecture
```
Browser
├─ React UI
├─ Web Worker(s) → Pyodide → MEMFS at /workspace
├─ IndexedDB "lace-persistence"
│     ├─ "files" store: { envId, path, content } (per-file storage)
│     └─ "environments" store: { id, name, color, persistent, createdAt }
└─ localStorage: last active environment id
```

- Each environment has a toggleable `persistent` flag (default: off)
- When persistence is ON: every file write/delete/rename mirrors to IndexedDB
- On init with persistence ON: files from IndexedDB are loaded into the worker's MEMFS
- Toggling ON: dumps current MEMFS files to IndexedDB
- Toggling OFF: clears that environment's IndexedDB entries
- Environment metadata always persists: the environment list (names, colors, persistence flags) survives page refresh
- The worker supports a `clear-workspace` message type to clear MEMFS before loading persisted files

### How It Works
1. App starts — loads environment metadata from IndexedDB (or creates default "Environment 1")
2. User clicks "+" tab to create additional environments
3. Each environment gets its own "Init" to load a separate Pyodide instance
4. If persistence is ON for an env, persisted files are loaded from IndexedDB after Pyodide initializes
5. Code runs in the active env's worker thread via `pyodide.runPythonAsync()` - UI stays responsive
6. stdout/stderr streams back to the terminal via `postMessage`
7. 10-second execution timeout with automatic worker termination
8. File operations (write/delete/rename) mirror to IndexedDB when persistence is enabled
9. Snapshots export per-environment workspace files as JSON

### State Management Pattern
- Per-environment state (activeFile, code, fileContents cache) stored in Maps keyed by envId
- Refs (`activeFileRef`, `codeRef`, `runCodeRef`, `activeEnvIdRef`) prevent stale closures in callbacks
- `updateEnv()` function applies partial updates to a specific environment in the environments array
- `getEnvPersistent()` reads the current persistent flag synchronously from state

### Features
- Multiple independent Python environments with separate workers
- Monaco code editor with Python syntax highlighting
- Multi-file workspace with create/rename/delete support
- Toggleable IndexedDB persistence per environment (files survive refresh)
- Environment list persistence (names/colors restored on reload)
- Package installer (micropip) for NumPy, Pandas, Matplotlib, etc.
- Keyboard shortcuts: Ctrl+Enter (run), Ctrl+S (save snapshot), ? (help)
- Resizable split-pane layout
- Environment tabs: create, switch, rename (double-click), remove
- Per-environment snapshots with environment name in filename
- Storage manager panel: view stored files per environment, preview contents, export/clear storage, total usage stats

## Design Tokens
- Background: #000000, Cards: #1A1A1A, Primary: lime green (hsl 88 50.4% 52.5%), Accent: purple (hsl 253.5 100% 75%)
- Environment colors cycle through: green, purple, blue, yellow, red, pink, teal, orange
- Fonts: Space Grotesk (UI), Geist Mono (code/terminal)
- Dark mode only

## Dependencies
- `@monaco-editor/react` - Code editor
- `react-resizable-panels` - Split pane layout
- Pyodide v0.24.1 (loaded from CDN at runtime)
