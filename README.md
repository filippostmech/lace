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
  <a href="#agent-api">Agent API</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
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
- **Headless Mode** — Run the entire system without a visible browser via Playwright for fully automated agent workflows
- **Offline Capable** — After initial Pyodide load (~20MB), everything runs locally

---

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 20.19+ or 22.12+ | Required for the Express server and build tools |
| **npm** | 10+ | Comes with Node.js |
| **Git** | any | To clone the repository |
| **Python** | 3.10+ | Only needed if using the Agent API or headless mode |

### Quick Start

```bash
git clone https://github.com/anthropics/lace.git
cd lace
npm install
npm run dev
```

Open `http://localhost:5000` in your browser. That's it — LACE is running.

On first use, click the **Init** button in the toolbar. This downloads the Pyodide runtime (~20MB) from a CDN. The browser caches it, so subsequent loads are instant.

### What Happens When You Run `npm run dev`

1. An **Express server** starts on port 5000 (configurable via the `PORT` environment variable)
2. **Vite** runs in development mode with hot module replacement (HMR) — code changes reflect instantly
3. The Express server serves the React frontend and proxies Vite's HMR websocket
4. No Python backend is needed — all Python execution happens in the browser via WebAssembly

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Port for the Express server |
| `NODE_ENV` | `development` | Set to `production` for the production build |

Replit-specific Vite plugins are automatically skipped when running outside Replit. No configuration changes are needed.

### Build for Production

```bash
npm run build
npm start
```

This compiles the React frontend into static assets and starts Express in production mode, serving the pre-built files without Vite's dev server. The production build is faster and smaller — suitable for deploying behind a reverse proxy (nginx, Caddy, etc.) or running on any machine with Node.js.

### Verify It Works

1. Open `http://localhost:5000` in a modern browser (Chrome, Firefox, Edge, Safari)
2. Click **Init** in the toolbar — wait for "Runtime ready" in the terminal
3. The editor shows `main.py` with example code
4. Click **Run** (or press `Ctrl+Enter`) — you should see output in the terminal panel

If Init succeeds and code runs, LACE is working correctly.

---

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

---

## Agent API

LACE can serve as a compute backend for AI agents. The **LACE Host** is a separate FastAPI server that accepts Python execution jobs via REST and relays them to the browser for execution in ephemeral Pyodide workers.

There are two ways to use the Agent API:

| Mode | When to use | What runs |
|------|-------------|-----------|
| **Interactive** | You have a browser open and want to see job activity | LACE Host + your browser |
| **Headless** | Fully automated, no visible browser needed | LACE Host + Express + headless Chromium |

### Prerequisites (Agent API)

```bash
cd host
pip install -r requirements.txt
```

This installs FastAPI, uvicorn, requests, and playwright. For headless mode, also install the Chromium browser binary:

```bash
playwright install chromium
```

### Option A: Interactive Mode

Use this when you want to run LACE in your browser and also accept agent jobs.

**Step 1: Start the LACE app** (in the project root):
```bash
npm run dev
```

**Step 2: Start the LACE Host** (in a separate terminal):
```bash
cd host
uvicorn server:app --host 127.0.0.1 --port 8080
```

**Step 3: Connect the browser to the Host**

1. Open `http://localhost:5000` in your browser
2. Click the connection indicator (gray dot) in the header bar
3. In the Jobs panel, enter the Host URL: `ws://127.0.0.1:8080/ws`
4. Click **Connect**
5. The dot turns green — LACE is ready to receive agent jobs

**Step 4: Submit a job**
```bash
curl -X POST http://127.0.0.1:8080/v1/jobs/python \
  -H "Content-Type: application/json" \
  -d '{"code": "print(sum(range(100)))"}'
```

### Option B: Headless Mode

Use this for fully automated workflows where no human interaction is needed. A single command starts everything:

```bash
cd host
python headless.py
```

This launches three processes:
1. **Express server** (port 5000) — serves the LACE React app
2. **LACE Host** (port 8080) — REST API + WebSocket relay
3. **Headless Chromium** — loads the app, connects to the Host, executes jobs invisibly

Wait for the readiness message:
```
============================================================
  LACE is running headless
============================================================

  Submit jobs:   POST http://127.0.0.1:8080/v1/jobs/python
  Get results:   GET  http://127.0.0.1:8080/v1/jobs/{id}
  Stream logs:   GET  http://127.0.0.1:8080/v1/jobs/{id}/stream
  Check status:  GET  http://127.0.0.1:8080/v1/status
  API docs:      http://127.0.0.1:8080/docs

  Press Ctrl+C to stop
```

Then submit jobs via `curl` or from your agent code.

#### Headless CLI Options

| Argument | Default | Description |
|----------|---------|-------------|
| `--app-port` | `5000` | Express server port |
| `--host-port` | `8080` | LACE Host FastAPI port |
| `--app-dir` | parent of `host/` | Path to the LACE project root |
| `--no-app` | off | Skip starting Express (if already running separately) |
| `--no-host` | off | Skip starting LACE Host (if already running separately) |
| `--connect-timeout` | `90` | Seconds to wait for browser to connect |

Examples:
```bash
python headless.py --app-port 3000 --host-port 9090
python headless.py --no-app                          # Express already running
python headless.py --no-app --no-host                # Both already running
```

### API Reference

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/jobs/python` | Submit a Python execution job |
| GET | `/v1/jobs/{id}` | Get job status and results |
| GET | `/v1/jobs/{id}/stream` | Stream job logs via SSE |
| DELETE | `/v1/jobs/{id}` | Cancel a running job |
| GET | `/v1/status` | Check if a browser compute node is connected |

Interactive API docs are available at `http://127.0.0.1:8080/docs` when the Host is running.

#### Job Request Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `code` | string | required | Python code to execute |
| `files` | array | `[]` | Files to write before execution: `[{"path": "data.csv", "content": "a,b\n1,2"}]` |
| `packages` | array | `[]` | Python packages to install via micropip before execution |
| `timeout` | int | `30000` | Execution timeout in milliseconds (min: 1000, max: 300000) |

#### Job Result Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Job ID (e.g. `job_abc123def456`) |
| `status` | string | `queued`, `running`, `completed`, `failed`, or `timeout` |
| `stdout` | string | Captured standard output |
| `stderr` | string | Captured standard error |
| `files` | array | Workspace files after execution: `[{"path": "...", "content": "..."}]` |
| `execution_time` | float | Execution time in milliseconds |
| `error` | string | Error message (if `status` is `failed`) |
| `created_at` | float | Unix timestamp when job was created |
| `completed_at` | float | Unix timestamp when job finished |

#### Submit a Job

```bash
curl -X POST http://127.0.0.1:8080/v1/jobs/python \
  -H "Content-Type: application/json" \
  -d '{
    "code": "import numpy as np\nprint(np.random.rand(5))",
    "packages": ["numpy"],
    "timeout": 30000
  }'
```

Response:
```json
{"id": "job_abc123def456", "status": "queued"}
```

#### Poll for Results

```bash
curl http://127.0.0.1:8080/v1/jobs/job_abc123def456
```

Response:
```json
{
  "id": "job_abc123def456",
  "status": "completed",
  "stdout": "[0.23 0.87 0.12 0.95 0.41]\n",
  "stderr": "",
  "files": [],
  "execution_time": 1234.5,
  "created_at": 1709500000.0,
  "completed_at": 1709500001.2
}
```

#### Synchronous Mode

Add `?wait=true` to block until the job completes (no polling needed):

```bash
curl -X POST "http://127.0.0.1:8080/v1/jobs/python?wait=true" \
  -H "Content-Type: application/json" \
  -d '{"code": "print(42)"}'
```

This blocks until the job completes and returns the full `JobResult` (with `stdout`, `stderr`, `files`, etc.) directly — no polling needed.

#### Submit a Job with Files

```bash
curl -X POST http://127.0.0.1:8080/v1/jobs/python \
  -H "Content-Type: application/json" \
  -d '{
    "code": "with open(\"/workspace/data.csv\") as f:\n    print(f.read())",
    "files": [{"path": "data.csv", "content": "name,score\nAlice,95\nBob,87"}]
  }'
```

#### Check Connection Status

```bash
curl http://127.0.0.1:8080/v1/status
```

Response:
```json
{"connected": true}
```

If `connected` is `false`, no browser compute node is connected. Submitting jobs will return a `503 Service Unavailable` error until a browser connects.

### End-to-End Example: Headless Mode

A complete walkthrough from zero to executing a job:

```bash
# 1. Clone and install
git clone https://github.com/anthropics/lace.git
cd lace
npm install

# 2. Install Python dependencies for the Agent API
cd host
pip install -r requirements.txt
playwright install chromium

# 3. Start headless mode (starts everything)
python headless.py

# 4. (In another terminal) Verify connection
curl http://127.0.0.1:8080/v1/status
# → {"connected": true}

# 5. Submit a job
curl -X POST http://127.0.0.1:8080/v1/jobs/python \
  -H "Content-Type: application/json" \
  -d '{"code": "for i in range(5): print(f\"Hello {i}\")"}'

# 6. Get the result (replace with your job ID)
curl http://127.0.0.1:8080/v1/jobs/job_XXXXXXXXXXXX

# 7. Or use synchronous mode (blocks until done)
curl -X POST "http://127.0.0.1:8080/v1/jobs/python?wait=true" \
  -H "Content-Type: application/json" \
  -d '{"code": "print(sum(range(1000)))"}'
# → full result returned directly

# 8. Stop everything
# Press Ctrl+C in the headless.py terminal
```

### LangGraph / Python Agent Integration

Use this helper function to call LACE from any Python agent (LangGraph, LangChain, custom):

```python
import requests
import time

LACE_HOST = "http://127.0.0.1:8080"

def run_python_in_lace(
    code: str,
    packages: list[str] = None,
    files: list[dict] = None,
    timeout: int = 30000,
    wait: bool = True,
) -> dict:
    """Execute Python code in a browser-based Pyodide sandbox via LACE.

    Args:
        code: Python source code to execute.
        packages: Optional list of packages to install (e.g. ["numpy", "pandas"]).
        files: Optional files to create before execution:
               [{"path": "data.csv", "content": "a,b\\n1,2"}]
        timeout: Execution timeout in milliseconds (default 30s, max 300s).
        wait: If True, blocks until the job completes. If False, returns the job ID.

    Returns:
        Job result dict with keys: id, status, stdout, stderr, files, execution_time.
    """
    payload = {
        "code": code,
        "packages": packages or [],
        "files": files or [],
        "timeout": timeout,
    }

    if wait:
        resp = requests.post(f"{LACE_HOST}/v1/jobs/python?wait=true", json=payload)
        return resp.json()

    resp = requests.post(f"{LACE_HOST}/v1/jobs/python", json=payload)
    job_id = resp.json()["id"]

    while True:
        result = requests.get(f"{LACE_HOST}/v1/jobs/{job_id}").json()
        if result["status"] in ("completed", "failed", "timeout"):
            return result
        time.sleep(0.5)


# Usage examples:

# Simple execution
result = run_python_in_lace("print('hello from LACE')")
print(result["stdout"])  # "hello from LACE\n"

# With packages
result = run_python_in_lace(
    code="import numpy as np; print(np.mean([1,2,3,4,5]))",
    packages=["numpy"],
)

# With input files
result = run_python_in_lace(
    code='import json\nwith open("/workspace/config.json") as f:\n    print(json.load(f))',
    files=[{"path": "config.json", "content": '{"key": "value"}'}],
)

# Check for errors
if result["status"] == "failed":
    print(f"Error: {result.get('error', result.get('stderr', 'unknown'))}")
elif result["status"] == "timeout":
    print("Execution timed out")
else:
    print(result["stdout"])
```

---

## Testing the Agent API

### Quick Smoke Test

After starting LACE (either interactive or headless), run these commands to verify everything works:

```bash
# 1. Check that a browser compute node is connected
curl -s http://127.0.0.1:8080/v1/status | python3 -m json.tool
# Expected: {"connected": true}

# 2. Submit a simple job (synchronous mode)
curl -s -X POST "http://127.0.0.1:8080/v1/jobs/python?wait=true" \
  -H "Content-Type: application/json" \
  -d '{"code": "print(2 + 2)"}' | python3 -m json.tool
# Expected: status "completed", stdout "4\n"

# 3. Test with a package
curl -s -X POST "http://127.0.0.1:8080/v1/jobs/python?wait=true" \
  -H "Content-Type: application/json" \
  -d '{"code": "import numpy; print(numpy.__version__)", "packages": ["numpy"]}' \
  | python3 -m json.tool
# Expected: status "completed", stdout shows numpy version

# 4. Test error handling
curl -s -X POST "http://127.0.0.1:8080/v1/jobs/python?wait=true" \
  -H "Content-Type: application/json" \
  -d '{"code": "raise ValueError(\"test error\")"}' | python3 -m json.tool
# Expected: status "failed", stderr contains the traceback

# 5. Test timeout
curl -s -X POST "http://127.0.0.1:8080/v1/jobs/python?wait=true" \
  -H "Content-Type: application/json" \
  -d '{"code": "import time; time.sleep(999)", "timeout": 2000}' \
  | python3 -m json.tool
# Expected: status "timeout"
```

---

## Keyboard Shortcuts

| Shortcut          | Action                     |
| ----------------- | -------------------------- |
| `Ctrl + Enter`    | Run current code           |
| `Ctrl + S`        | Save workspace snapshot    |
| `Ctrl + N`        | Create new file            |
| `?`               | Toggle shortcuts help      |

---

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
│  Browser (or Headless Chromium)                                 │
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
│  ┌───────────────────────────────────────────────────┐         │
│  │  IndexedDB "lace-persistence" (optional)          │         │
│  │  ├── files store: { envId, path, content }        │         │
│  │  └── environments store: { id, name, color, ... } │         │
│  └───────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────────┘
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
- **FastAPI** — Agent API server (LACE Host)
- **Playwright** — Headless browser automation (for headless mode)

---

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
│   ├── headless.py                      # Headless launcher (Express + Host + Chromium)
│   ├── requirements.txt                 # Python dependencies
│   └── README.md                        # Host API docs and headless mode docs
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

---

## How It Works

### Multi-Environment System

Each environment is fully independent with its own Web Worker, Pyodide instance, filesystem, terminal output, and installed packages. The `useEnvironmentManager` hook manages the lifecycle of all environments. Environment metadata (names, colors, persistence flags) is stored in IndexedDB so the environment list survives page refreshes.

### Pyodide Loading

When the user clicks "Init", the app creates a Web Worker that loads Pyodide from the jsDelivr CDN. Pyodide is a full CPython 3.11 interpreter compiled to WebAssembly, capable of running most pure-Python packages.

### Web Worker Communication

All Python execution runs in dedicated Web Worker threads, keeping the UI responsive. The main thread and workers communicate via `postMessage`:

- **Main -> Worker**: Commands like `init`, `run`, `list-files`, `read-file`, `write-file`, `install-package`, `clear-workspace`
- **Worker -> Main**: Results like `stdout`, `stderr`, `status`, `file-list`, `file-content`, `snapshot`

### File System & Persistence

Pyodide provides an in-memory filesystem (Emscripten MEMFS). LACE creates a `/workspace` directory where all user files live. File operations are executed as Python code within the worker.

When persistence is enabled for an environment, file operations are also mirrored to IndexedDB. On the next init, persisted files are loaded from IndexedDB into the worker's filesystem, replacing the default scaffold files.

### Agent Job Execution

When an agent submits a job via the LACE Host REST API:

1. The Host assigns a job ID and stores it in memory
2. The job is relayed to the browser (or headless Chromium) via WebSocket
3. The browser spawns an **ephemeral Web Worker** with a fresh Pyodide instance
4. Files and packages from the job request are loaded into the worker
5. The Python code executes with stdout/stderr captured in real time
6. On completion, a workspace snapshot (all files as base64) is sent back
7. The Host stores the result, which the agent retrieves via `GET /v1/jobs/{id}`

Each job gets its own isolated worker — jobs cannot interfere with each other or with the user's environments.

### Security

- All code runs in the browser sandbox — nothing is sent to any server (except Agent API responses to the LACE Host)
- Each Web Worker provides thread isolation from the main UI
- Agent jobs run in ephemeral workers that are terminated after execution
- File paths are sanitized to prevent directory traversal
- A configurable execution timeout automatically terminates runaway scripts
- Snapshots are pure JSON exported locally
- Persisted data stays in the browser's IndexedDB — never transmitted
- The LACE Host binds to `127.0.0.1` by default (localhost only)

---

## Troubleshooting

### Pyodide won't load / Init hangs

- **Check network access**: Pyodide is loaded from the jsDelivr CDN (`cdn.jsdelivr.net`). Ensure your network allows access.
- **Check browser console**: Open DevTools (F12) and look for network errors or CORS issues.
- **Try a different browser**: Chrome and Firefox have the best WebAssembly support.
- **Clear cache**: Hard refresh with `Ctrl+Shift+R` to bypass cached files.

### `npm run dev` fails

- **Check Node.js version**: Run `node --version` — must be 20.19+ or 22.12+.
- **Reinstall dependencies**: Delete `node_modules` and run `npm install` again.
- **Port conflict**: If port 5000 is in use, set a different port: `PORT=3000 npm run dev`.

### Agent jobs return 503 or won't execute

- **Check connection**: Run `curl http://127.0.0.1:8080/v1/status`. If `connected` is `false`, no browser is connected to the Host and job submissions will return `503`.
- **Interactive mode**: Make sure you've entered the Host URL (`ws://127.0.0.1:8080/ws`) in the Jobs panel and clicked Connect.
- **Headless mode**: Check the `headless.py` output for errors. Ensure Chromium is installed (`playwright install chromium`).

### `headless.py` fails to connect

- **Install Chromium**: Run `playwright install chromium` before the first run.
- **Port conflict**: Ensure ports 5000 and 8080 are free, or use `--app-port` and `--host-port` to change them.
- **Check Python version**: Requires Python 3.10+.
- **Check dependencies**: Run `pip install -r host/requirements.txt`.
- **Increase timeout**: If Pyodide takes longer to load, use `--connect-timeout 120`.

### LACE Host won't start

- **Install dependencies**: `cd host && pip install -r requirements.txt`.
- **Port in use**: Change the port: `uvicorn server:app --port 9090`.
- **Check Python**: The Host requires Python 3.10+ with `fastapi` and `uvicorn`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to LACE.

## License

[MIT](LICENSE)
