import asyncio
import json
import time
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models import (
    JobRequest, JobResult, JobSubmitResponse, JobStatus,
    StatusResponse, FileItem,
)
from job_store import JobStore

app = FastAPI(title="LACE Host", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = JobStore()
browser_ws: WebSocket | None = None
_log_subscribers: dict[str, list[asyncio.Queue]] = {}


def generate_job_id() -> str:
    return f"job_{uuid.uuid4().hex[:12]}"


async def _send_to_browser(message: dict) -> bool:
    global browser_ws
    if browser_ws is None:
        return False
    try:
        await browser_ws.send_json(message)
        return True
    except Exception:
        browser_ws = None
        return False


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global browser_ws
    await ws.accept()
    browser_ws = ws
    print("[LACE Host] Browser compute node connected")
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            try:
                if msg_type == "job-status":
                    job_id = data.get("jobId")
                    status = data.get("status")
                    store.update(job_id, status=status)

                elif msg_type == "job-log":
                    job_id = data.get("jobId")
                    stream = data.get("stream", "stdout")
                    text = data.get("text", "")
                    if stream == "stderr":
                        store.append_stderr(job_id, text + "\n")
                    else:
                        store.append_stdout(job_id, text + "\n")
                    queues = _log_subscribers.get(job_id, [])
                    for q in queues:
                        await q.put({"stream": stream, "text": text})

                elif msg_type == "job-result":
                    job_id = data.get("jobId")
                    result = data.get("result", {})
                    raw_files = result.get("files", [])
                    files = []
                    for f in raw_files:
                        try:
                            files.append(FileItem(
                                path=str(f.get("path", "")),
                                content=str(f.get("content", f.get("base64_content", ""))),
                            ))
                        except Exception:
                            pass
                    store.update(
                        job_id,
                        status=result.get("status", JobStatus.COMPLETED),
                        stdout=result.get("stdout", ""),
                        stderr=result.get("stderr", ""),
                        files=files,
                        execution_time=result.get("executionTime"),
                        error=result.get("error"),
                        completed_at=time.time(),
                    )
                    queues = _log_subscribers.get(job_id, [])
                    for q in queues:
                        await q.put(None)

            except Exception as msg_err:
                print(f"[LACE Host] Error processing message type={msg_type}: {msg_err}")
                job_id = data.get("jobId")
                if job_id:
                    store.update(
                        job_id,
                        status=JobStatus.FAILED,
                        error=f"Host processing error: {msg_err}",
                        completed_at=time.time(),
                    )

    except WebSocketDisconnect:
        print("[LACE Host] Browser compute node disconnected")
        browser_ws = None
    except Exception as e:
        print(f"[LACE Host] WebSocket error: {e}")
        browser_ws = None


@app.post("/v1/jobs/python", status_code=202)
async def submit_job(request: JobRequest, wait: bool = Query(False)):
    if browser_ws is None:
        raise HTTPException(status_code=503, detail="No compute node connected")

    job_id = generate_job_id()
    store.create(job_id)

    sent = await _send_to_browser({
        "type": "job-submit",
        "job": {
            "id": job_id,
            "code": request.code,
            "files": [f.model_dump() for f in request.files],
            "packages": request.packages,
            "timeout": request.timeout,
        },
    })

    if not sent:
        store.update(job_id, status=JobStatus.FAILED, error="Failed to dispatch to compute node")
        raise HTTPException(status_code=503, detail="Failed to send job to compute node")

    if wait:
        timeout_seconds = (request.timeout / 1000) + 30
        result = await store.wait_for_completion(job_id, timeout=timeout_seconds)
        if result:
            return result
        job = store.get(job_id)
        if job:
            return job
        return JobSubmitResponse(id=job_id, status=JobStatus.QUEUED)

    return JobSubmitResponse(id=job_id, status=JobStatus.QUEUED)


@app.get("/v1/jobs/{job_id}", response_model=JobResult)
async def get_job(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/v1/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    queue: asyncio.Queue = asyncio.Queue()
    if job_id not in _log_subscribers:
        _log_subscribers[job_id] = []
    _log_subscribers[job_id].append(queue)

    async def event_generator():
        try:
            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.TIMEOUT):
                yield f"data: {json.dumps({'type': 'result', 'status': job.status, 'stdout': job.stdout, 'stderr': job.stderr})}\n\n"
                return

            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=60)
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
                    continue

                if msg is None:
                    final = store.get(job_id)
                    if final:
                        yield f"data: {json.dumps({'type': 'result', 'status': final.status, 'stdout': final.stdout, 'stderr': final.stderr})}\n\n"
                    break

                yield f"data: {json.dumps({'type': 'log', 'stream': msg['stream'], 'text': msg['text']})}\n\n"
        finally:
            if job_id in _log_subscribers:
                _log_subscribers[job_id].remove(queue)
                if not _log_subscribers[job_id]:
                    del _log_subscribers[job_id]

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.delete("/v1/jobs/{job_id}")
async def cancel_job(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.TIMEOUT):
        raise HTTPException(status_code=409, detail="Job already finished")

    await _send_to_browser({"type": "job-cancel", "jobId": job_id})
    store.update(job_id, status=JobStatus.FAILED, error="Cancelled by user", completed_at=time.time())
    return {"id": job_id, "status": "cancelled"}


@app.get("/v1/status", response_model=StatusResponse)
async def get_status():
    return StatusResponse(
        connected=browser_ws is not None,
        active_jobs=len(store.list_active()),
    )
