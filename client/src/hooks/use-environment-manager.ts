import { useState, useRef, useCallback, useEffect } from "react";
import type { RuntimeStatus, TerminalLine, InstalledPackage } from "./use-pyodide";

export type { RuntimeStatus, TerminalLine, InstalledPackage };

const ENV_COLORS = [
  "hsl(88, 50.4%, 52.5%)",
  "hsl(253.5, 100%, 75%)",
  "hsl(199, 89%, 48%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 72%, 51%)",
  "hsl(330, 81%, 60%)",
  "hsl(160, 84%, 39%)",
  "hsl(30, 100%, 50%)",
];

export interface Environment {
  id: string;
  name: string;
  status: RuntimeStatus;
  lines: TerminalLine[];
  files: string[];
  installedPackages: InstalledPackage[];
  installingPackage: string | null;
  color: string;
  createdAt: number;
}

interface WorkerState {
  worker: Worker | null;
  timeout: ReturnType<typeof setTimeout> | null;
  pendingReads: Map<string, (data: string) => void>;
  statusRef: RuntimeStatus;
}

let lineIdCounter = 0;
let requestIdCounter = 0;
let envIdCounter = 0;

function generateEnvId(): string {
  return "env_" + (++envIdCounter) + "_" + Math.random().toString(36).slice(2, 8);
}

export function useEnvironmentManager() {
  const [environments, setEnvironments] = useState<Environment[]>(() => {
    const id = generateEnvId();
    return [{
      id,
      name: "Environment 1",
      status: "idle",
      lines: [],
      files: [],
      installedPackages: [],
      installingPackage: null,
      color: ENV_COLORS[0],
      createdAt: Date.now(),
    }];
  });
  const [activeEnvId, setActiveEnvId] = useState<string>(() => environments[0]?.id || "");

  const workersRef = useRef<Map<string, WorkerState>>(new Map());

  const getWorkerState = useCallback((envId: string): WorkerState => {
    if (!workersRef.current.has(envId)) {
      workersRef.current.set(envId, {
        worker: null,
        timeout: null,
        pendingReads: new Map(),
        statusRef: "idle",
      });
    }
    return workersRef.current.get(envId)!;
  }, []);

  const updateEnv = useCallback((envId: string, updates: Partial<Environment>) => {
    setEnvironments(prev => {
      if (!prev.some(e => e.id === envId)) return prev;
      return prev.map(e => e.id === envId ? { ...e, ...updates } : e);
    });
  }, []);

  const addLine = useCallback((envId: string, type: TerminalLine["type"], text: string) => {
    const newLine: TerminalLine = {
      id: ++lineIdCounter,
      type,
      text,
      timestamp: Date.now(),
    };
    setEnvironments(prev => {
      if (!prev.some(e => e.id === envId)) return prev;
      return prev.map(e =>
        e.id === envId ? { ...e, lines: [...e.lines, newLine] } : e
      );
    });
  }, []);

  const destroyWorker = useCallback((envId: string) => {
    const ws = workersRef.current.get(envId);
    if (!ws) return;
    if (ws.timeout) {
      clearTimeout(ws.timeout);
      ws.timeout = null;
    }
    if (ws.worker) {
      ws.worker.terminate();
      ws.worker = null;
    }
    ws.pendingReads.forEach(resolve => resolve(""));
    ws.pendingReads.clear();
  }, []);

  const initRuntime = useCallback((envId?: string) => {
    const targetId = envId || activeEnvId;
    destroyWorker(targetId);
    const ws = getWorkerState(targetId);

    updateEnv(targetId, { status: "loading", files: [], installedPackages: [] });
    ws.statusRef = "loading";
    addLine(targetId, "system", "Initializing Pyodide runtime...");

    const worker = new Worker("/pyodide-worker.js");
    ws.worker = worker;

    worker.onmessage = (e) => {
      const msg = e.data;

      if (msg.type === "stdout") {
        addLine(targetId, "stdout", msg.text);
      } else if (msg.type === "stderr") {
        addLine(targetId, "stderr", msg.text);
      } else if (msg.type === "error") {
        addLine(targetId, "stderr", msg.text);
        updateEnv(targetId, { status: "error" });
        ws.statusRef = "error";
      } else if (msg.type === "status") {
        if (msg.status === "ready") {
          updateEnv(targetId, { status: "ready" });
          ws.statusRef = "ready";
          addLine(targetId, "system", "Runtime ready. Python 3.11 (Pyodide/WASM)");
          worker.postMessage({ type: "list-files" });
          worker.postMessage({ type: "list-packages" });
        } else if (msg.status === "running") {
          updateEnv(targetId, { status: "running" });
          ws.statusRef = "running";
        } else if (msg.status === "done") {
          if (ws.timeout) {
            clearTimeout(ws.timeout);
            ws.timeout = null;
          }
          updateEnv(targetId, { status: "ready" });
          ws.statusRef = "ready";
        } else if (msg.status === "snapshot-loaded") {
          addLine(targetId, "system", "Snapshot loaded successfully.");
          worker.postMessage({ type: "list-files" });
        }
      } else if (msg.type === "snapshot") {
        setEnvironments(prev => {
          const env = prev.find(e => e.id === targetId);
          const envName = env?.name || "env";
          try {
            const blob = new Blob([msg.data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const safeName = envName.replace(/[^a-zA-Z0-9-_]/g, "_");
            a.download = `lace-snapshot-${safeName}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } catch {}
          return prev;
        });
        addLine(targetId, "system", "Snapshot exported.");
      } else if (msg.type === "file-list") {
        updateEnv(targetId, { files: msg.files || [] });
      } else if (msg.type === "file-content") {
        const rid = msg.requestId;
        if (rid && ws.pendingReads.has(rid)) {
          const resolve = ws.pendingReads.get(rid)!;
          ws.pendingReads.delete(rid);
          resolve(msg.content || "");
        }
      } else if (msg.type === "file-written" || msg.type === "file-deleted" || msg.type === "file-renamed") {
        worker.postMessage({ type: "list-files" });
      } else if (msg.type === "package-status") {
        if (msg.status === "installing") {
          updateEnv(targetId, { installingPackage: msg.packageName });
          addLine(targetId, "system", `Installing ${msg.packageName}...`);
        } else if (msg.status === "installed") {
          updateEnv(targetId, { installingPackage: null });
          addLine(targetId, "system", `Package ${msg.packageName} installed successfully.`);
          worker.postMessage({ type: "list-packages" });
        } else if (msg.status === "error") {
          updateEnv(targetId, { installingPackage: null });
          addLine(targetId, "stderr", `Failed to install ${msg.packageName}: ${msg.error}`);
        }
      } else if (msg.type === "package-list") {
        updateEnv(targetId, { installedPackages: msg.packages || [] });
      }
    };

    worker.onerror = () => {
      addLine(targetId, "stderr", "Worker error occurred.");
      updateEnv(targetId, { status: "error" });
      ws.statusRef = "error";
    };

    worker.postMessage({ type: "init" });
  }, [activeEnvId, destroyWorker, getWorkerState, updateEnv, addLine]);

  const runCode = useCallback((code: string, timeout = 10000, envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker || ws.statusRef !== "ready") return;
    ws.worker.postMessage({ type: "run", code });

    ws.timeout = setTimeout(() => {
      addLine(targetId, "stderr", `Execution timed out after ${timeout / 1000}s. Worker terminated.`);
      destroyWorker(targetId);
      updateEnv(targetId, { status: "idle" });
      ws.statusRef = "idle";
      addLine(targetId, "system", "Runtime terminated. Re-initialize to continue.");
    }, timeout);
  }, [activeEnvId, getWorkerState, addLine, destroyWorker, updateEnv]);

  const stopExecution = useCallback((envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (ws.worker) {
      addLine(targetId, "system", "Execution stopped. Worker terminated.");
      destroyWorker(targetId);
      updateEnv(targetId, { status: "idle" });
      ws.statusRef = "idle";
      addLine(targetId, "system", "Runtime terminated. Re-initialize to continue.");
    }
  }, [activeEnvId, getWorkerState, addLine, destroyWorker, updateEnv]);

  const clearTerminal = useCallback((envId?: string) => {
    const targetId = envId || activeEnvId;
    updateEnv(targetId, { lines: [] });
  }, [activeEnvId, updateEnv]);

  const saveSnapshot = useCallback((envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker || ws.statusRef !== "ready") return;
    ws.worker.postMessage({ type: "save-snapshot" });
  }, [activeEnvId, getWorkerState]);

  const loadSnapshot = useCallback((jsonString: string, envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker || ws.statusRef !== "ready") return;
    ws.worker.postMessage({ type: "load-snapshot", snapshot: jsonString });
  }, [activeEnvId, getWorkerState]);

  const readFile = useCallback((path: string, envId?: string): Promise<string> => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    return new Promise((resolve) => {
      if (!ws.worker) { resolve(""); return; }
      const rid = "req_" + (++requestIdCounter);
      ws.pendingReads.set(rid, resolve);
      ws.worker.postMessage({ type: "read-file", path, requestId: rid });
      setTimeout(() => {
        if (ws.pendingReads.has(rid)) {
          ws.pendingReads.delete(rid);
          resolve("");
        }
      }, 5000);
    });
  }, [activeEnvId, getWorkerState]);

  const writeFile = useCallback((path: string, content: string, envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker) return;
    ws.worker.postMessage({ type: "write-file", path, content });
  }, [activeEnvId, getWorkerState]);

  const deleteFile = useCallback((path: string, envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker) return;
    ws.worker.postMessage({ type: "delete-file", path });
  }, [activeEnvId, getWorkerState]);

  const renameFile = useCallback((oldPath: string, newPath: string, envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker) return;
    ws.worker.postMessage({ type: "rename-file", path: oldPath, newPath });
  }, [activeEnvId, getWorkerState]);

  const installPackage = useCallback((packageName: string, envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker || ws.statusRef !== "ready") return;
    ws.worker.postMessage({ type: "install-package", packageName });
  }, [activeEnvId, getWorkerState]);

  const listPackages = useCallback((envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker) return;
    ws.worker.postMessage({ type: "list-packages" });
  }, [activeEnvId, getWorkerState]);

  const listFiles = useCallback((envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker) return;
    ws.worker.postMessage({ type: "list-files" });
  }, [activeEnvId, getWorkerState]);

  const createEnvironment = useCallback((name?: string): string => {
    const id = generateEnvId();
    setEnvironments(prev => {
      const colorIndex = prev.length % ENV_COLORS.length;
      const newEnv: Environment = {
        id,
        name: name || `Environment ${prev.length + 1}`,
        status: "idle",
        lines: [],
        files: [],
        installedPackages: [],
        installingPackage: null,
        color: ENV_COLORS[colorIndex],
        createdAt: Date.now(),
      };
      return [...prev, newEnv];
    });
    return id;
  }, []);

  const removeEnvironment = useCallback((envId: string) => {
    setEnvironments(prev => {
      if (prev.length <= 1) return prev;
      destroyWorker(envId);
      workersRef.current.delete(envId);
      const remaining = prev.filter(e => e.id !== envId);
      if (envId === activeEnvId) {
        setActiveEnvId(remaining[0].id);
      }
      return remaining;
    });
  }, [activeEnvId, destroyWorker]);

  const renameEnvironment = useCallback((envId: string, newName: string) => {
    updateEnv(envId, { name: newName });
  }, [updateEnv]);

  const switchEnvironment = useCallback((envId: string) => {
    setActiveEnvId(envId);
  }, []);

  useEffect(() => {
    const workers = workersRef.current;
    return () => {
      workers.forEach((ws, envId) => {
        if (ws.timeout) clearTimeout(ws.timeout);
        if (ws.worker) ws.worker.terminate();
        ws.pendingReads.forEach(resolve => resolve(""));
        ws.pendingReads.clear();
      });
      workers.clear();
    };
  }, []);

  const activeEnv = environments.find(e => e.id === activeEnvId) || environments[0];

  return {
    environments,
    activeEnvId,
    activeEnv,
    createEnvironment,
    removeEnvironment,
    renameEnvironment,
    switchEnvironment,
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
