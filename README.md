<p align="center">
  <img src="assets/lace-logo.png" alt="LACE Logo" width="180" />
</p>

<h1 align="center">LACE</h1>

<p align="center">
  <strong>Local Agent Compute Environment</strong><br/>
  A browser-based Python sandbox powered by Pyodide (CPython compiled to WebAssembly).<br/>
  Write, edit, and run Python code entirely in your browser — no server, no installation, no data leaves your machine.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#getting-started">Get Started</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://substack.com"><img src="https://img.shields.io/badge/Substack-Read%20Article-orange?logo=substack&logoColor=white" alt="Substack Article" /></a>
</p>

---

## Features

- **In-Browser Python Execution** — Full CPython 3.11 running via WebAssembly, no backend required
- **Multiple Environments** — Create independent Python environments, each with its own worker thread, filesystem, and terminal output. Run code in parallel across environments
- **Monaco Code Editor** — VS Code's editor with Python syntax highlighting, bracket matching, and smooth scrolling
- **Multi-File Workspace** — Create, rename, and delete files in an in-memory `/workspace` filesystem per environment
- **Persistent Storage** — Toggle IndexedDB persistence per environment so workspace files survive page refreshes and browser restarts
- **Storage Manager** — View, preview, export, and clear stored files from a built-in panel
- **Package Management** — Install Python packages (NumPy, Pandas, Matplotlib, etc.) via micropip
- **Workspace Snapshots** — Export and import your entire workspace as JSON for sharing
- **Streaming Terminal Output** — Real-time stdout/stderr display with auto-scroll
- **Execution Timeout** — Automatic 10-second timeout with worker termination to prevent runaway scripts
- **Resizable Split Panes** — Adjustable file explorer, editor, and terminal panels
- **Keyboard Shortcuts** — Ctrl+Enter to run, Ctrl+S to save snapshot, and more
- **Agent Jobs API** — External agents (LangGraph, etc.) submit Python jobs via the LACE Host, executed in ephemeral browser workers
- **Offline Capable** — After initial Pyodide load (~20MB), everything runs locally

## Architecture

LACE has two modes: **manual** (human uses the IDE directly) and **agent** (external agent submits jobs via the LACE Host API). The Express backend serves the React frontend. The LACE Host (separate FastAPI server) provides the agent-facing REST API.

```
┌────────────────────────────────────────────────────────────────┐
│  Agent (e.g. LangGraph)                                        │
│  POST /v1/jobs/python ──► LACE Host (FastAPI, port 8080)       │
│  GET  /v1/jobs/{id}   ◄── returns results                     │
└────────────────────────────┬───────────────────────────────────┘
                             │ WebSocket
┌────────────────────────────▼───────────────────────────────────┐
│  Browser                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  React App (Main Thread)                                  │ │
│  │  ├── Environment Switcher (tabs for N envs)               │ │
│  │  ├── Monaco Editor                                        │ │
│  │  ├── File Explorer                                        │ │
│  │  ├── Terminal Output                                      │ │
│  │  ├── Package Installer                                    │ │
│  │  ├── Storage Manager                                      │ │
│  │  └── Job Executor (WebSocket client for agent jobs)       │ │
│  └──────────────┬───────────────────┬────────────────────────┘ │
│                 │ postMessage        │ postMessage              │
│  ┌──────────────▼──────────────┐  ┌─▼──────────────────────┐  │
│  │  User Workers (per env)     │  │  Agent Workers          │  │
│  │  ├── Pyodide (CPython 3.11) │  │  (ephemeral per job)    │  │
│  │  ├── /workspace filesystem  │  │  ├── Pyodide            │  │
│  │  └── micropip               │  │  ├── fresh /workspace   │  │
│  └─────────────────────────────┘  │  └── terminated on done │  │
│                                    └────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  IndexedDB "lace-persistence" (optional)          │  │
│  │  ├── files store: { envId, path, content }        │  │
│  │  └── environments store: { id, name, color, ... } │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
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

### 5. Multiple Environments

- **Create** — Click the + tab in the environment switcher to create a new isolated environment
- **Switch** — Click any environment tab to switch; each has its own files, terminal, and runtime
- **Rename** — Double-click a tab name to rename inline
- **Remove** — Hover over a tab and click the X to remove (cannot remove the last one)
- **Parallel execution** — Each environment runs in its own Web Worker thread, so you can run code in multiple environments simultaneously

### 6. Persistent Storage

- **Enable** — Click the **Persist** button in the toolbar to save workspace files to browser storage (IndexedDB)
- **Automatic sync** — When persistence is on, every file write/delete/rename is mirrored to IndexedDB
- **Survives refresh** — Persisted files are automatically restored when you init the environment after a page reload
- **Disable** — Click Persist again to turn it off and clear stored files for that environment
- **Per-environment** — Each environment can independently have persistence on or off

### 7. Storage Manager

Click the hard drive icon in the header to open the Storage Manager panel. From here you can:
- See which environments have persistence enabled
- View how many files and how much space each environment uses
- Expand file lists and preview stored file contents
- Export an environment's stored files as JSON
- Clear storage per environment or clear all storage at once

### 8. Install Packages

Expand the **Packages** section in the sidebar to install Python packages via micropip. Popular packages (NumPy, Pandas, Matplotlib, etc.) are available as one-click installs.

### 9. Snapshots

- **Save** — Click Save (or `Ctrl+S`) to export all workspace files as a JSON file
- **Load** — Click Load to import a previously saved snapshot

## Agent API

LACE can serve as a compute backend for AI agents. The **LACE Host** is a separate FastAPI server that accepts Python execution jobs via REST API and relays them to the browser for execution in ephemeral Pyodide workers.

### Start the LACE Host

```bash
cd host
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8080
```

API docs: `http://127.0.0.1:8080/docs`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/jobs/python` | Submit a Python execution job |
| GET | `/v1/jobs/{id}` | Get job status and results |
| GET | `/v1/jobs/{id}/stream` | Stream job logs via SSE |
| DELETE | `/v1/jobs/{id}` | Cancel a running job |
| GET | `/v1/status` | Check if browser compute node is connected |

### Submit a Job

```bash
curl -X POST http://127.0.0.1:8080/v1/jobs/python \
  -H "Content-Type: application/json" \
  -d '{
    "code": "import numpy as np\nprint(np.random.rand(5))",
    "packages": ["numpy"],
    "timeout": 30000
  }'
# → { "id": "job_abc123def456", "status": "queued" }
```

### Get Results

```bash
curl http://127.0.0.1:8080/v1/jobs/job_abc123def456
# → { "id": "...", "status": "completed", "stdout": "[0.23 0.87 ...]", ... }
```

### LangGraph Integration

```python
import requests
import time

LACE_HOST = "http://127.0.0.1:8080"

def run_python_in_lace(code: str, packages: list[str] = None) -> dict:
    """Execute Python code in a browser-based Pyodide sandbox."""
    resp = requests.post(f"{LACE_HOST}/v1/jobs/python", json={
        "code": code,
        "packages": packages or [],
        "timeout": 30000,
    })
    job_id = resp.json()["id"]

    while True:
        result = requests.get(f"{LACE_HOST}/v1/jobs/{job_id}").json()
        if result["status"] in ("completed", "failed", "timeout"):
            return result
        time.sleep(0.5)
```

### Browser Connection

The LACE browser app connects to the Host via WebSocket. In the header, a connection indicator shows the status:
- **Green dot** — Connected to LACE Host, ready to receive jobs
- **Gray dot** — Disconnected (click to configure Host URL)

Click the indicator to open the Jobs panel where you can configure the Host URL, connect/disconnect, and view job history.

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
│   │   ├── pyodide-worker.js            # Web Worker running Pyodide
│   │   └── favicon.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── environment-switcher.tsx  # Environment tab bar
│   │   │   ├── file-explorer.tsx         # Sidebar file tree
│   │   │   ├── jobs-panel.tsx            # Agent jobs panel (connection, history)
│   │   │   ├── package-installer.tsx     # Package management UI
│   │   │   ├── shortcuts-help.tsx        # Keyboard shortcuts overlay
│   │   │   ├── storage-manager.tsx       # Browser storage viewer/manager
│   │   │   ├── terminal-output.tsx       # Streaming output display
│   │   │   ├── toolbar.tsx              # Control buttons + persist toggle
│   │   │   └── ui/                      # shadcn/ui components
│   │   ├── hooks/
│   │   │   ├── use-environment-manager.ts # Multi-env lifecycle + persistence
│   │   │   ├── use-job-executor.ts        # Agent job executor React hook
│   │   │   └── use-pyodide.ts             # Type definitions
│   │   ├── pages/
│   │   │   └── lace.tsx                 # Main application page
│   │   ├── lib/
│   │   │   ├── job-executor.ts          # WebSocket client + ephemeral worker manager
│   │   │   ├── persistence.ts           # IndexedDB storage layer
│   │   │   └── utils.ts                 # Utility functions
│   │   ├── App.tsx                      # Root component with routing
│   │   ├── main.tsx                     # Entry point
│   │   └── index.css                    # Global styles and design tokens
│   └── index.html
├── host/
│   ├── server.py                        # FastAPI app (REST API + WebSocket relay)
│   ├── models.py                        # Pydantic models (JobRequest, JobResult)
│   ├── job_store.py                     # In-memory job store
│   ├── requirements.txt                 # Python dependencies
│   └── README.md                        # Host quick-start and API docs
├── server/
│   ├── index.ts                         # Express server entry point
│   ├── routes.ts                        # API routes (minimal)
│   ├── static.ts                        # Static file serving
│   └── vite.ts                          # Vite dev server integration
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

## How It Works

### Multi-Environment System

Each environment is fully independent with its own Web Worker, Pyodide instance, filesystem, terminal output, and installed packages. The `useEnvironmentManager` hook manages the lifecycle of all environments. Environment metadata (names, colors, persistence flags) is stored in IndexedDB so the environment list survives page refreshes.

### Pyodide Loading

When the user clicks "Init", the app creates a Web Worker that loads Pyodide from the jsDelivr CDN. Pyodide is a full CPython 3.11 interpreter compiled to WebAssembly, capable of running most pure-Python packages.

### Web Worker Communication

All Python execution runs in dedicated Web Worker threads, keeping the UI responsive. The main thread and workers communicate via `postMessage`:

- **Main → Worker**: Commands like `init`, `run`, `list-files`, `read-file`, `write-file`, `install-package`, `clear-workspace`
- **Worker → Main**: Results like `stdout`, `stderr`, `status`, `file-list`, `file-content`, `snapshot`

### File System & Persistence

Pyodide provides an in-memory filesystem (Emscripten MEMFS). LACE creates a `/workspace` directory where all user files live. File operations are executed as Python code within the worker.

When persistence is enabled for an environment, file operations are also mirrored to IndexedDB. On the next init, persisted files are loaded from IndexedDB into the worker's filesystem, replacing the default scaffold files.

### Security

- All code runs in the browser sandbox — nothing is sent to any server
- Each Web Worker provides thread isolation from the main UI
- File paths are sanitized to prevent directory traversal
- A 10-second execution timeout automatically terminates runaway scripts
- Snapshots are pure JSON exported locally
- Persisted data stays in the browser's IndexedDB — never transmitted

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to LACE.

## License

[MIT](LICENSE)
