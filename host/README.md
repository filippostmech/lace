# LACE Host

The LACE Host is a FastAPI server that bridges external agents (like LangGraph) with the LACE browser app. It exposes a REST API for submitting Python execution jobs and relays them to the browser via WebSocket, where they run in ephemeral Pyodide Web Workers.

## Quick Start

```bash
cd host
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8080
```

The API docs are available at `http://127.0.0.1:8080/docs`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/jobs/python` | Submit a Python execution job |
| GET | `/v1/jobs/{id}` | Get job status and results |
| GET | `/v1/jobs/{id}/stream` | Stream job logs via SSE |
| DELETE | `/v1/jobs/{id}` | Cancel a running job |
| GET | `/v1/status` | Check if a browser compute node is connected |
| WS | `/ws` | WebSocket endpoint for browser connection |

## Submit a Job

```bash
curl -X POST http://127.0.0.1:8080/v1/jobs/python \
  -H "Content-Type: application/json" \
  -d '{
    "code": "print(sum(range(100)))",
    "timeout": 30000
  }'
```

Response:
```json
{ "id": "job_abc123def456", "status": "queued" }
```

## Get Results

```bash
curl http://127.0.0.1:8080/v1/jobs/job_abc123def456
```

Response:
```json
{
  "id": "job_abc123def456",
  "status": "completed",
  "stdout": "4950\n",
  "stderr": "",
  "files": [],
  "execution_time": 1234.5,
  "created_at": 1709500000.0,
  "completed_at": 1709500001.2
}
```

## Job Request Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `code` | string | required | Python code to execute |
| `files` | array | `[]` | Files to write before execution: `[{ path, content }]` |
| `packages` | array | `[]` | Python packages to install via micropip |
| `timeout` | int | `30000` | Execution timeout in milliseconds (1s - 300s) |

## Synchronous Mode

Add `?wait=true` to block until the job completes and return the full result (no polling needed):

```bash
curl -X POST "http://127.0.0.1:8080/v1/jobs/python?wait=true" \
  -H "Content-Type: application/json" \
  -d '{ "code": "print(42)" }'
```

Returns the full `JobResult` with `stdout`, `stderr`, `files`, etc. directly.

## LangGraph Integration

```python
import requests
import time

LACE_HOST = "http://127.0.0.1:8080"

def run_python(code: str, packages: list[str] = None, timeout: int = 30000) -> dict:
    resp = requests.post(f"{LACE_HOST}/v1/jobs/python", json={
        "code": code,
        "packages": packages or [],
        "timeout": timeout,
    })
    job_id = resp.json()["id"]

    while True:
        result = requests.get(f"{LACE_HOST}/v1/jobs/{job_id}").json()
        if result["status"] in ("completed", "failed", "timeout"):
            return result
        time.sleep(0.5)
```

## Headless Mode

Run LACE without a visible browser window. A single command starts everything needed for agent-driven Python execution.

### Prerequisites

```bash
cd host
pip install -r requirements.txt
playwright install chromium
```

### Quick Start

```bash
python headless.py
```

This starts three processes:
1. **Express server** (port 5000) — serves the LACE React app
2. **LACE Host** (port 8080) — REST API + WebSocket relay
3. **Headless Chromium** — loads the app, connects to the Host, executes jobs

Once you see `LACE is running headless`, submit jobs:

```bash
curl -X POST http://127.0.0.1:8080/v1/jobs/python \
  -H "Content-Type: application/json" \
  -d '{"code": "print(sum(range(100)))", "timeout": 30000}'
```

### CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--app-port` | `5000` | Express server port |
| `--host-port` | `8080` | LACE Host FastAPI port |
| `--app-dir` | parent of `host/` | Path to the LACE project root |
| `--no-app` | off | Skip starting Express (if already running) |
| `--no-host` | off | Skip starting LACE Host (if already running) |
| `--connect-timeout` | `90` | Seconds to wait for browser to connect |

### Examples

```bash
# Everything managed by the launcher
python headless.py

# Custom ports
python headless.py --app-port 3000 --host-port 9090

# Express already running, only start Host + headless browser
python headless.py --no-app

# Both servers already running, only start headless browser
python headless.py --no-app --no-host
```

### How It Works

1. Starts Express (`npm run dev`) and LACE Host (`uvicorn server:app`)
2. Waits for both servers to be ready (HTTP health checks)
3. Launches a headless Chromium browser via Playwright
4. Pre-seeds localStorage with the LACE Host WebSocket URL
5. Navigates to the Express server URL
6. The LACE React app loads and auto-connects to the Host via WebSocket
7. Polls `/v1/status` until `connected: true`
8. Reports readiness and keeps running until Ctrl+C
9. On shutdown, cleanly stops browser and all subprocesses
