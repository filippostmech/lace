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

Add `?wait=true` to block until the job completes:

```bash
curl -X POST "http://127.0.0.1:8080/v1/jobs/python?wait=true" \
  -H "Content-Type: application/json" \
  -d '{ "code": "print(42)" }'
```

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
