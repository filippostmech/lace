from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class FileItem(BaseModel):
    path: str
    content: str


class JobRequest(BaseModel):
    code: str
    files: list[FileItem] = Field(default_factory=list)
    packages: list[str] = Field(default_factory=list)
    timeout: int = Field(default=30000, ge=1000, le=300000)


class JobResult(BaseModel):
    id: str
    status: JobStatus
    stdout: str = ""
    stderr: str = ""
    files: list[FileItem] = Field(default_factory=list)
    execution_time: Optional[float] = None
    error: Optional[str] = None
    created_at: float
    completed_at: Optional[float] = None


class JobSubmitResponse(BaseModel):
    id: str
    status: JobStatus


class StatusResponse(BaseModel):
    connected: bool
    active_jobs: int
