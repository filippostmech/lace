import { useState, useRef, useCallback, useEffect } from "react";

export type RuntimeStatus = "idle" | "loading" | "ready" | "running" | "error";

export interface TerminalLine {
  id: number;
  type: "stdout" | "stderr" | "system";
  text: string;
  timestamp: number;
}

export interface InstalledPackage {
  name: string;
  version: string;
}

let lineIdCounter = 0;
let requestIdCounter = 0;

export function usePyodide() {
  const [status, setStatus] = useState<RuntimeStatus>("idle");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [installingPackage, setInstallingPackage] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReadsRef = useRef<Map<string, (data: string) => void>>(new Map());
  const statusRef = useRef<RuntimeStatus>("idle");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const addLine = useCallback((type: TerminalLine["type"], text: string) => {
    const newLine: TerminalLine = {
      id: ++lineIdCounter,
      type,
      text,
      timestamp: Date.now(),
    };
    setLines((prev) => [...prev, newLine]);
  }, []);

  const clearTerminal = useCallback(() => {
    setLines([]);
  }, []);

  const destroyWorker = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    pendingReadsRef.current.forEach((resolve) => resolve(""));
    pendingReadsRef.current.clear();
  }, []);

  const initRuntime = useCallback(() => {
    destroyWorker();
    setStatus("loading");
    statusRef.current = "loading";
    setFiles([]);
    setInstalledPackages([]);
    addLine("system", "Initializing Pyodide runtime...");

    const worker = new Worker("/pyodide-worker.js");
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;

      if (msg.type === "stdout") {
        addLine("stdout", msg.text);
      } else if (msg.type === "stderr") {
        addLine("stderr", msg.text);
      } else if (msg.type === "error") {
        addLine("stderr", msg.text);
        setStatus((prev) => (prev === "loading" ? "error" : prev));
        statusRef.current = "error";
      } else if (msg.type === "status") {
        if (msg.status === "ready") {
          setStatus("ready");
          statusRef.current = "ready";
          addLine("system", "Runtime ready. Python 3.11 (Pyodide/WASM)");
          worker.postMessage({ type: "list-files" });
          worker.postMessage({ type: "list-packages" });
        } else if (msg.status === "running") {
          setStatus("running");
          statusRef.current = "running";
        } else if (msg.status === "done") {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setStatus("ready");
          statusRef.current = "ready";
        } else if (msg.status === "snapshot-loaded") {
          addLine("system", "Snapshot loaded successfully.");
          worker.postMessage({ type: "list-files" });
        }
      } else if (msg.type === "snapshot") {
        try {
          const blob = new Blob([msg.data], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `lace-snapshot-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
          a.click();
          URL.revokeObjectURL(url);
          addLine("system", "Snapshot exported.");
        } catch {
          addLine("stderr", "Failed to export snapshot.");
        }
      } else if (msg.type === "file-list") {
        setFiles(msg.files || []);
      } else if (msg.type === "file-content") {
        const rid = msg.requestId;
        if (rid && pendingReadsRef.current.has(rid)) {
          const resolve = pendingReadsRef.current.get(rid)!;
          pendingReadsRef.current.delete(rid);
          resolve(msg.content || "");
        }
      } else if (msg.type === "file-written") {
        worker.postMessage({ type: "list-files" });
      } else if (msg.type === "file-deleted") {
        worker.postMessage({ type: "list-files" });
      } else if (msg.type === "file-renamed") {
        worker.postMessage({ type: "list-files" });
      } else if (msg.type === "package-status") {
        if (msg.status === "installing") {
          setInstallingPackage(msg.packageName);
          addLine("system", `Installing ${msg.packageName}...`);
        } else if (msg.status === "installed") {
          setInstallingPackage(null);
          addLine("system", `Package ${msg.packageName} installed successfully.`);
          worker.postMessage({ type: "list-packages" });
        } else if (msg.status === "error") {
          setInstallingPackage(null);
          addLine("stderr", `Failed to install ${msg.packageName}: ${msg.error}`);
        }
      } else if (msg.type === "package-list") {
        setInstalledPackages(msg.packages || []);
      }
    };

    worker.onerror = () => {
      addLine("stderr", "Worker error occurred.");
      setStatus("error");
      statusRef.current = "error";
    };

    worker.postMessage({ type: "init" });
  }, [destroyWorker, addLine]);

  const runCode = useCallback(
    (code: string, timeout = 10000) => {
      if (!workerRef.current || statusRef.current !== "ready") return;
      workerRef.current.postMessage({ type: "run", code });

      timeoutRef.current = setTimeout(() => {
        addLine("stderr", `Execution timed out after ${timeout / 1000}s. Worker terminated.`);
        destroyWorker();
        setStatus("idle");
        statusRef.current = "idle";
        addLine("system", "Runtime terminated. Re-initialize to continue.");
      }, timeout);
    },
    [addLine, destroyWorker]
  );

  const stopExecution = useCallback(() => {
    if (workerRef.current) {
      addLine("system", "Execution stopped. Worker terminated.");
      destroyWorker();
      setStatus("idle");
      statusRef.current = "idle";
      addLine("system", "Runtime terminated. Re-initialize to continue.");
    }
  }, [destroyWorker, addLine]);

  const saveSnapshot = useCallback(() => {
    if (!workerRef.current || statusRef.current !== "ready") return;
    workerRef.current.postMessage({ type: "save-snapshot" });
  }, []);

  const loadSnapshot = useCallback(
    (jsonString: string) => {
      if (!workerRef.current || statusRef.current !== "ready") return;
      workerRef.current.postMessage({ type: "load-snapshot", snapshot: jsonString });
    },
    []
  );

  const readFile = useCallback(
    (path: string): Promise<string> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve("");
          return;
        }
        const rid = "req_" + (++requestIdCounter);
        pendingReadsRef.current.set(rid, resolve);
        workerRef.current.postMessage({ type: "read-file", path, requestId: rid });

        setTimeout(() => {
          if (pendingReadsRef.current.has(rid)) {
            pendingReadsRef.current.delete(rid);
            resolve("");
          }
        }, 5000);
      });
    },
    []
  );

  const writeFile = useCallback(
    (path: string, content: string) => {
      if (!workerRef.current) return;
      workerRef.current.postMessage({ type: "write-file", path, content });
    },
    []
  );

  const deleteFile = useCallback(
    (path: string) => {
      if (!workerRef.current) return;
      workerRef.current.postMessage({ type: "delete-file", path });
    },
    []
  );

  const renameFile = useCallback(
    (oldPath: string, newPath: string) => {
      if (!workerRef.current) return;
      workerRef.current.postMessage({ type: "rename-file", path: oldPath, newPath });
    },
    []
  );

  const installPackage = useCallback(
    (packageName: string) => {
      if (!workerRef.current || statusRef.current !== "ready") return;
      workerRef.current.postMessage({ type: "install-package", packageName });
    },
    []
  );

  const listPackages = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "list-packages" });
  }, []);

  const listFiles = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "list-files" });
  }, []);

  return {
    status,
    lines,
    files,
    installedPackages,
    installingPackage,
    initRuntime,
    runCode,
    stopExecution,
    clearTerminal,
    saveSnapshot,
    loadSnapshot,
    listFiles,
    readFile,
    writeFile,
    deleteFile,
    renameFile,
    installPackage,
    listPackages,
  };
}
