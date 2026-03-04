export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface JobSummary {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "timeout";
  startedAt: number;
  completedAt?: number;
  stdout: string;
  stderr: string;
  error?: string;
}

interface JobSubmitMessage {
  type: "job-submit";
  job: {
    id: string;
    code: string;
    files: { path: string; content: string }[];
    packages: string[];
    timeout: number;
  };
}

interface JobCancelMessage {
  type: "job-cancel";
  jobId: string;
}

type HostMessage = JobSubmitMessage | JobCancelMessage;

type StatusListener = (status: ConnectionStatus) => void;
type JobsListener = (jobs: JobSummary[]) => void;

export class JobExecutor {
  private ws: WebSocket | null = null;
  private _status: ConnectionStatus = "disconnected";
  private _hostUrl: string;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _activeWorkers: Map<string, Worker> = new Map();
  private _activeTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private _jobs: Map<string, JobSummary> = new Map();
  private _statusListeners: Set<StatusListener> = new Set();
  private _jobsListeners: Set<JobsListener> = new Set();
  private _shouldReconnect = false;

  constructor(hostUrl: string = "ws://127.0.0.1:8080/ws") {
    this._hostUrl = hostUrl;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get hostUrl(): string {
    return this._hostUrl;
  }

  get activeJobs(): JobSummary[] {
    return Array.from(this._jobs.values()).filter(
      (j) => j.status === "queued" || j.status === "running"
    );
  }

  get recentJobs(): JobSummary[] {
    return Array.from(this._jobs.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 50);
  }

  onStatusChange(listener: StatusListener) {
    this._statusListeners.add(listener);
    return () => this._statusListeners.delete(listener);
  }

  onJobsChange(listener: JobsListener) {
    this._jobsListeners.add(listener);
    return () => this._jobsListeners.delete(listener);
  }

  private _setStatus(status: ConnectionStatus) {
    this._status = status;
    this._statusListeners.forEach((fn) => fn(status));
  }

  private _notifyJobs() {
    const jobs = this.recentJobs;
    this._jobsListeners.forEach((fn) => fn(jobs));
  }

  private _send(data: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  connect(url?: string) {
    if (url) this._hostUrl = url;
    this._shouldReconnect = true;
    this._doConnect();
  }

  private _doConnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this._setStatus("connecting");

    try {
      this.ws = new WebSocket(this._hostUrl);
    } catch {
      this._setStatus("disconnected");
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._setStatus("connected");
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
    };

    this.ws.onclose = () => {
      this._setStatus("disconnected");
      this.ws = null;
      if (this._shouldReconnect) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as HostMessage;
        this._handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };
  }

  disconnect() {
    this._shouldReconnect = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this._setStatus("disconnected");
  }

  destroy() {
    this.disconnect();
    this._activeWorkers.forEach((w) => w.terminate());
    this._activeWorkers.clear();
    this._activeTimeouts.forEach((t) => clearTimeout(t));
    this._activeTimeouts.clear();
  }

  private _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (this._shouldReconnect) {
        this._doConnect();
      }
    }, 5000);
  }

  private _handleMessage(msg: HostMessage) {
    if (msg.type === "job-submit") {
      this._executeJob(msg.job);
    } else if (msg.type === "job-cancel") {
      this._cancelJob(msg.jobId);
    }
  }

  private _cancelJob(jobId: string) {
    const worker = this._activeWorkers.get(jobId);
    if (worker) {
      worker.terminate();
      this._activeWorkers.delete(jobId);
    }
    const timeout = this._activeTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this._activeTimeouts.delete(jobId);
    }
    const job = this._jobs.get(jobId);
    if (job && (job.status === "queued" || job.status === "running")) {
      job.status = "failed";
      job.error = "Cancelled";
      job.completedAt = Date.now();
      this._notifyJobs();
    }
  }

  private async _executeJob(jobDef: JobSubmitMessage["job"]) {
    const { id, code, files, packages, timeout } = jobDef;

    const summary: JobSummary = {
      id,
      status: "running",
      startedAt: Date.now(),
      stdout: "",
      stderr: "",
    };
    this._jobs.set(id, summary);
    this._notifyJobs();

    this._send({ type: "job-status", jobId: id, status: "running" });

    const worker = new Worker("/pyodide-worker.js");
    this._activeWorkers.set(id, worker);

    const timeoutHandle = setTimeout(() => {
      worker.terminate();
      this._activeWorkers.delete(id);
      this._activeTimeouts.delete(id);
      summary.status = "timeout";
      summary.error = `Execution timed out after ${timeout / 1000}s`;
      summary.completedAt = Date.now();
      this._send({
        type: "job-result",
        jobId: id,
        result: {
          status: "timeout",
          stdout: summary.stdout,
          stderr: summary.stderr,
          files: [],
          executionTime: Date.now() - summary.startedAt,
          error: summary.error,
        },
      });
      this._notifyJobs();
    }, timeout + 15000);
    this._activeTimeouts.set(id, timeoutHandle);

    try {
      await this._runInWorker(worker, id, summary, code, files, packages, timeout);
    } catch (err) {
      summary.status = "failed";
      summary.error = err instanceof Error ? err.message : String(err);
      summary.completedAt = Date.now();
      this._send({
        type: "job-result",
        jobId: id,
        result: {
          status: "failed",
          stdout: summary.stdout,
          stderr: summary.stderr,
          files: [],
          executionTime: Date.now() - summary.startedAt,
          error: summary.error,
        },
      });
      this._notifyJobs();
    } finally {
      clearTimeout(timeoutHandle);
      this._activeTimeouts.delete(id);
      if (this._activeWorkers.has(id)) {
        worker.terminate();
        this._activeWorkers.delete(id);
      }
    }
  }

  private _runInWorker(
    worker: Worker,
    jobId: string,
    summary: JobSummary,
    code: string,
    files: { path: string; content: string }[],
    packages: string[],
    _timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let phase: "init" | "packages" | "files" | "run" | "snapshot" = "init";
      let packageIndex = 0;
      let fileIndex = 0;
      let snapshotData: { path: string; content: string }[] = [];

      const sendLog = (stream: "stdout" | "stderr", text: string) => {
        if (stream === "stdout") summary.stdout += text + "\n";
        else summary.stderr += text + "\n";
        this._send({ type: "job-log", jobId, stream, text });
      };

      worker.onmessage = (e) => {
        const msg = e.data;

        if (msg.type === "stdout") {
          sendLog("stdout", msg.text);
        } else if (msg.type === "stderr") {
          sendLog("stderr", msg.text);
        } else if (msg.type === "error") {
          sendLog("stderr", msg.text);
        } else if (msg.type === "status") {
          if (msg.status === "ready" && phase === "init") {
            if (packages.length > 0) {
              phase = "packages";
              worker.postMessage({
                type: "install-package",
                packageName: packages[packageIndex],
              });
            } else if (files.length > 0) {
              phase = "files";
              worker.postMessage({
                type: "write-file",
                path: files[fileIndex].path,
                content: files[fileIndex].content,
              });
            } else {
              phase = "run";
              worker.postMessage({ type: "run", code });
            }
          } else if (msg.status === "done" && phase === "run") {
            phase = "snapshot";
            worker.postMessage({ type: "save-snapshot", requestId: `job_${jobId}` });
          }
        } else if (msg.type === "package-status") {
          if (msg.status === "installed" || msg.status === "error") {
            if (msg.status === "error") {
              sendLog("stderr", `Failed to install ${msg.packageName}: ${msg.error || "unknown"}`);
            }
            packageIndex++;
            if (packageIndex < packages.length) {
              worker.postMessage({
                type: "install-package",
                packageName: packages[packageIndex],
              });
            } else if (files.length > 0) {
              phase = "files";
              worker.postMessage({
                type: "write-file",
                path: files[fileIndex].path,
                content: files[fileIndex].content,
              });
            } else {
              phase = "run";
              worker.postMessage({ type: "run", code });
            }
          }
        } else if (msg.type === "file-written") {
          if (phase === "files") {
            fileIndex++;
            if (fileIndex < files.length) {
              worker.postMessage({
                type: "write-file",
                path: files[fileIndex].path,
                content: files[fileIndex].content,
              });
            } else {
              phase = "run";
              worker.postMessage({ type: "run", code });
            }
          }
        } else if (msg.type === "snapshot") {
          try {
            const parsed = JSON.parse(msg.data);
            if (Array.isArray(parsed)) {
              snapshotData = parsed.map((f: { path: string; base64_content: string }) => ({
                path: f.path.replace(/^\/workspace\//, ""),
                content: f.base64_content,
              }));
            } else {
              snapshotData = [];
            }
          } catch {
            snapshotData = [];
          }

          summary.status = "completed";
          summary.completedAt = Date.now();
          this._send({
            type: "job-result",
            jobId,
            result: {
              status: "completed",
              stdout: summary.stdout,
              stderr: summary.stderr,
              files: snapshotData,
              executionTime: Date.now() - summary.startedAt,
            },
          });
          this._notifyJobs();
          resolve();
        }
      };

      worker.onerror = (err) => {
        reject(new Error(err.message || "Worker error"));
      };

      worker.postMessage({ type: "init" });
    });
  }
}
