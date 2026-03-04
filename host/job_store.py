import asyncio
import time
from collections import OrderedDict
from typing import Optional

from models import JobResult, JobStatus


class JobStore:
    def __init__(self, max_jobs: int = 1000):
        self._jobs: OrderedDict[str, JobResult] = OrderedDict()
        self._events: dict[str, asyncio.Event] = {}
        self._max_jobs = max_jobs

    def create(self, job_id: str) -> JobResult:
        if len(self._jobs) >= self._max_jobs:
            oldest_key = next(iter(self._jobs))
            self._jobs.pop(oldest_key)
            self._events.pop(oldest_key, None)

        job = JobResult(
            id=job_id,
            status=JobStatus.QUEUED,
            created_at=time.time(),
        )
        self._jobs[job_id] = job
        self._events[job_id] = asyncio.Event()
        return job

    def get(self, job_id: str) -> Optional[JobResult]:
        return self._jobs.get(job_id)

    def update(self, job_id: str, **kwargs) -> Optional[JobResult]:
        job = self._jobs.get(job_id)
        if not job:
            return None
        for key, value in kwargs.items():
            if hasattr(job, key):
                setattr(job, key, value)
        if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.TIMEOUT):
            event = self._events.get(job_id)
            if event:
                event.set()
        return job

    def append_stdout(self, job_id: str, text: str):
        job = self._jobs.get(job_id)
        if job:
            job.stdout += text

    def append_stderr(self, job_id: str, text: str):
        job = self._jobs.get(job_id)
        if job:
            job.stderr += text

    async def wait_for_completion(self, job_id: str, timeout: float) -> Optional[JobResult]:
        event = self._events.get(job_id)
        if not event:
            return None
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            pass
        return self._jobs.get(job_id)

    def list_active(self) -> list[JobResult]:
        return [j for j in self._jobs.values() if j.status in (JobStatus.QUEUED, JobStatus.RUNNING)]

    def list_recent(self, limit: int = 50) -> list[JobResult]:
        return list(reversed(list(self._jobs.values())))[:limit]
