# LACE - Local Agent Compute Environment

A browser-based Python sandbox powered by Pyodide (CPython compiled to WebAssembly). Write, edit, and run Python code entirely in your browser — no server, no installation, no data leaves your machine.

## Features

- **In-Browser Python Execution** — Full CPython 3.11 running via WebAssembly, no backend required
- **Monaco Code Editor** — VS Code's editor with Python syntax highlighting, bracket matching, and smooth scrolling
- **Multi-File Workspace** — Create, rename, and delete files in an in-memory `/workspace` filesystem
- **Package Management** — Install Python packages (NumPy, Pandas, Matplotlib, etc.) via micropip
- **Workspace Snapshots** — Export and import your entire workspace as JSON for persistence and sharing
- **Streaming Terminal Output** — Real-time stdout/stderr display with auto-scroll
- **Execution Timeout** — Automatic 10-second timeout with worker termination to prevent runaway scripts
- **Resizable Split Panes** — Adjustable file explorer, editor, and terminal panels
- **Keyboard Shortcuts** — Ctrl+Enter to run, Ctrl+S to save snapshot, and more
- **Offline Capable** — After initial Pyodide load (~20MB), everything runs locally

## Architecture

LACE is a **frontend-only application**. The Express backend serves static files only — all Python execution happens client-side in a Web Worker.

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│  ┌───────────────────────────────────────────┐  │
│  │  React App (Main Thread)                  │  │
│  │  ├── Monaco Editor                        │  │
│  │  ├── File Explorer                        │  │
│  │  ├── Terminal Output                      │  │
│  │  └── Package Installer                    │  │
│  └──────────────┬────────────────────────────┘  │
│                 │ postMessage                    │
│  ┌──────────────▼────────────────────────────┐  │
│  │  Web Worker                               │  │
│  │  ├── Pyodide (CPython 3.11 / WASM)        │  │
│  │  ├── In-memory filesystem (/workspace)    │  │
│  │  └── micropip (package installer)         │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Tech Stack

- **React 18** — UI framework
- **Monaco Editor** — Code editor (`@monaco-editor/react`)
- **Pyodide v0.24.1** — CPython compiled to WebAssembly (loaded from CDN)
- **Tailwind CSS** — Styling
- **shadcn/ui** — UI component library
- **react-resizable-panels** — Split pane layout
- **Express** — Static file server
- **Vite** — Build tool and dev server
- **TypeScript** — Type safety throughout

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Quick Start

```bash
# Clone the repository
git clone https://github.com/anthropics/lace.git
cd lace

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5000`.

### Build for Production

```bash
npm run build
npm start
```

## Usage

### 1. Initialize the Runtime

Click the **Init** button in the toolbar to load the Pyodide runtime. This downloads ~20MB of WebAssembly on first load (cached by the browser afterward).

### 2. Write Code

Use the Monaco editor to write Python code. The workspace starts with example files (`main.py`, `utils.py`, `data_example.py`).

### 3. Run Code

Click **Run** or press `Ctrl+Enter` to execute the current file. Output streams to the terminal panel in real time.

### 4. File Management

- **Create files** — Click the + icon in the file explorer sidebar
- **Rename files** — Click the pencil icon on hover
- **Delete files** — Click the trash icon on hover
- **Switch files** — Click any file in the explorer; changes auto-save when switching

### 5. Install Packages

Expand the **Packages** section in the sidebar to install Python packages via micropip. Popular packages (NumPy, Pandas, Matplotlib, etc.) are available as one-click installs.

### 6. Snapshots

- **Save** — Click Save (or `Ctrl+S`) to export all workspace files as a JSON file
- **Load** — Click Load to import a previously saved snapshot

## Keyboard Shortcuts

| Shortcut          | Action                     |
| ----------------- | -------------------------- |
| `Ctrl + Enter`    | Run current code           |
| `Ctrl + S`        | Save workspace snapshot    |
| `Ctrl + N`        | Create new file            |
| `?`               | Toggle shortcuts help      |

## Project Structure

```
lace/
├── client/
│   ├── public/
│   │   ├── pyodide-worker.js    # Web Worker running Pyodide
│   │   └── favicon.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── file-explorer.tsx     # Sidebar file tree
│   │   │   ├── package-installer.tsx # Package management UI
│   │   │   ├── shortcuts-help.tsx    # Keyboard shortcuts overlay
│   │   │   ├── terminal-output.tsx   # Streaming output display
│   │   │   ├── toolbar.tsx           # Control buttons
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── hooks/
│   │   │   └── use-pyodide.ts   # Pyodide Web Worker lifecycle hook
│   │   ├── pages/
│   │   │   └── lace.tsx         # Main application page
│   │   ├── lib/
│   │   │   └── utils.ts         # Utility functions
│   │   ├── App.tsx              # Root component with routing
│   │   ├── main.tsx             # Entry point
│   │   └── index.css            # Global styles and design tokens
│   └── index.html
├── server/
│   ├── index.ts                 # Server entry point
│   ├── routes.ts                # API routes (minimal)
│   ├── static.ts                # Static file serving
│   └── vite.ts                  # Vite dev server integration
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

## How It Works

### Pyodide Loading

When the user clicks "Init", the app creates a Web Worker that loads Pyodide from the jsDelivr CDN. Pyodide is a full CPython 3.11 interpreter compiled to WebAssembly, capable of running most pure-Python packages.

### Web Worker Communication

All Python execution runs in a dedicated Web Worker thread, keeping the UI responsive. The main thread and worker communicate via `postMessage`:

- **Main → Worker**: Commands like `init`, `run`, `list-files`, `read-file`, `write-file`, `install-package`
- **Worker → Main**: Results like `stdout`, `stderr`, `status`, `file-list`, `file-content`, `snapshot`

### File System

Pyodide provides an in-memory filesystem (Emscripten FS). LACE creates a `/workspace` directory where all user files live. File operations (create, read, write, delete, rename) are executed as Python code within the worker.

### Security

- All code runs in the browser sandbox — nothing is sent to any server
- The Web Worker provides thread isolation from the main UI
- File paths are sanitized to prevent directory traversal
- A 10-second execution timeout automatically terminates runaway scripts
- Snapshots are pure JSON exported locally

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to LACE.

## License

[MIT](LICENSE)
