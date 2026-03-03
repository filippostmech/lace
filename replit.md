# LACE - Local Agent Compute Environment

Browser-based Python sandbox powered by Pyodide (CPython compiled to WebAssembly). All Python execution happens entirely in the browser via a Web Worker - no server-side execution.

## Architecture

**Frontend-only application** - the Express backend only serves static files. All computation happens client-side.

### Key Components
- `client/src/pages/lace.tsx` - Main page: split-pane layout with environment tabs, sidebar, editor, and terminal
- `client/src/hooks/use-environment-manager.ts` - Hook managing multiple independent Pyodide environments, each with its own Web Worker
- `client/src/hooks/use-pyodide.ts` - Type definitions (RuntimeStatus, TerminalLine, InstalledPackage) shared across the app
- `client/public/pyodide-worker.js` - Web Worker running Pyodide (loaded from CDN on-demand)
- `client/src/components/environment-switcher.tsx` - Tab bar for creating, switching, renaming, and removing environments
- `client/src/components/file-explorer.tsx` - Sidebar file tree for the in-memory `/workspace` filesystem
- `client/src/components/package-installer.tsx` - UI for installing Python packages via micropip
- `client/src/components/toolbar.tsx` - Control buttons (Init, Run, Stop, Clear, Save/Load Snapshot) with environment context
- `client/src/components/terminal-output.tsx` - Streaming stdout/stderr/system output display
- `client/src/components/shortcuts-help.tsx` - Keyboard shortcuts overlay

### Multi-Environment Architecture
```
useEnvironmentManager hook
   ├─ Environment 1: { id, name, worker, status, files, lines, packages, color }
   ├─ Environment 2: { id, name, worker, status, files, lines, packages, color }
   └─ Environment N: ...
```

Each environment is fully independent:
- Own Web Worker (separate thread) with its own Pyodide instance
- Own `/workspace` filesystem (isolated in-memory)
- Own terminal output, installed packages, and runtime status
- Environments can run code in parallel (each in its own worker thread)
- UI shows one "active" environment at a time, but all run independently in the background

### How It Works
1. App starts with one default environment ("Environment 1")
2. User clicks "+" tab to create additional environments
3. Each environment gets its own "Init" to load a separate Pyodide instance
4. Code runs in the active env's worker thread via `pyodide.runPythonAsync()` - UI stays responsive
5. stdout/stderr streams back to the terminal via `postMessage`
6. 10-second execution timeout with automatic worker termination
7. Workspace files live in each environment's Pyodide in-memory filesystem at `/workspace`
8. Snapshots export per-environment workspace files as JSON

### State Management Pattern
- Per-environment state (activeFile, code, fileContents cache) stored in Maps keyed by envId
- Refs (`activeFileRef`, `codeRef`, `runCodeRef`, `activeEnvIdRef`) prevent stale closures in callbacks
- `updateEnv()` function applies partial updates to a specific environment in the environments array

### Features
- Multiple independent Python environments with separate workers
- Monaco code editor with Python syntax highlighting
- Multi-file workspace with create/rename/delete support
- Package installer (micropip) for NumPy, Pandas, Matplotlib, etc.
- Keyboard shortcuts: Ctrl+Enter (run), Ctrl+S (save snapshot), ? (help)
- Resizable split-pane layout
- Environment tabs: create, switch, rename (double-click), remove
- Per-environment snapshots with environment name in filename

## Design Tokens
- Background: #000000, Cards: #1A1A1A, Primary: lime green (hsl 88 50.4% 52.5%), Accent: purple (hsl 253.5 100% 75%)
- Environment colors cycle through: green, purple, blue, yellow, red, pink, teal, orange
- Fonts: Space Grotesk (UI), Geist Mono (code/terminal)
- Dark mode only

## Dependencies
- `@monaco-editor/react` - Code editor
- `react-resizable-panels` - Split pane layout
- Pyodide v0.24.1 (loaded from CDN at runtime)
