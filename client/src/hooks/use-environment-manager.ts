import { useState, useRef, useCallback, useEffect } from "react";
import type { RuntimeStatus, TerminalLine, InstalledPackage } from "./use-pyodide";
import {
  saveFileToDB,
  deleteFileFromDB,
  renameFileInDB,
  loadAllFilesFromDB,
  clearEnvironmentFiles,
  saveEnvironmentMeta,
  loadAllEnvironmentMetas,
  deleteEnvironmentMeta,
  saveAllFilesToDB,
  type EnvironmentMeta,
} from "@/lib/persistence";

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
  persistent: boolean;
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

const ACTIVE_ENV_KEY = "lace-active-env-id";

function saveActiveEnvToStorage(envId: string) {
  try { localStorage.setItem(ACTIVE_ENV_KEY, envId); } catch {}
}

function loadActiveEnvFromStorage(): string | null {
  try { return localStorage.getItem(ACTIVE_ENV_KEY); } catch { return null; }
}

function envToMeta(env: Environment): EnvironmentMeta {
  return { id: env.id, name: env.name, color: env.color, persistent: env.persistent, createdAt: env.createdAt };
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
      persistent: false,
    }];
  });
  const [activeEnvId, setActiveEnvId] = useState<string>(() => environments[0]?.id || "");
  const [restoredFromDB, setRestoredFromDB] = useState(false);

  const workersRef = useRef<Map<string, WorkerState>>(new Map());
  const environmentsRef = useRef<Environment[]>(environments);
  useEffect(() => { environmentsRef.current = environments; }, [environments]);

  useEffect(() => {
    let cancelled = false;
    loadAllEnvironmentMetas().then(metas => {
      if (cancelled || metas.length === 0) {
        setRestoredFromDB(true);
        return;
      }
      const restored: Environment[] = metas.map(m => ({
        id: m.id,
        name: m.name,
        status: "idle" as RuntimeStatus,
        lines: [],
        files: [],
        installedPackages: [],
        installingPackage: null,
        color: m.color,
        createdAt: m.createdAt,
        persistent: m.persistent,
      }));
      setEnvironments(restored);
      const savedActiveId = loadActiveEnvFromStorage();
      const validId = restored.find(e => e.id === savedActiveId)?.id || restored[0].id;
      setActiveEnvId(validId);
      setRestoredFromDB(true);
    }).catch(() => {
      setRestoredFromDB(true);
    });
    return () => { cancelled = true; };
  }, []);

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

  const getEnvPersistent = useCallback((envId: string): boolean => {
    const env = environmentsRef.current.find(e => e.id === envId);
    return env?.persistent ?? false;
  }, []);

  const loadPersistedFilesIntoWorker = useCallback(async (envId: string) => {
    const ws = getWorkerState(envId);
    if (!ws.worker) return;

    const files = await loadAllFilesFromDB(envId);
    if (files.length === 0) return;

    await new Promise<void>((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === "workspace-cleared") {
          ws.worker?.removeEventListener("message", handler);
          resolve();
        }
      };
      ws.worker!.addEventListener("message", handler);
      ws.worker!.postMessage({ type: "clear-workspace" });
      setTimeout(() => {
        ws.worker?.removeEventListener("message", handler);
        resolve();
      }, 5000);
    });

    for (const file of files) {
      ws.worker!.postMessage({ type: "write-file", path: file.path, content: file.content });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    ws.worker!.postMessage({ type: "list-files" });
    addLine(envId, "system", `Loaded ${files.length} persisted file(s) from browser storage.`);
  }, [getWorkerState, addLine]);

  const initRuntime = useCallback((envId?: string) => {
    const targetId = envId || activeEnvId;
    destroyWorker(targetId);
    const ws = getWorkerState(targetId);

    updateEnv(targetId, { status: "loading", files: [], installedPackages: [] });
    ws.statusRef = "loading";
    addLine(targetId, "system", "Initializing Pyodide runtime...");

    const worker = new Worker("/pyodide-worker.js");
    ws.worker = worker;

    const isPersistent = getEnvPersistent(targetId);

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

          if (isPersistent) {
            loadPersistedFilesIntoWorker(targetId).catch(() => {});
          } else {
            worker.postMessage({ type: "list-files" });
          }
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
      } else if (msg.type === "snapshot" && !msg.requestId) {
        const envForSnapshot = environmentsRef.current.find(e => e.id === targetId);
        const envName = envForSnapshot?.name || "env";
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
  }, [activeEnvId, destroyWorker, getWorkerState, updateEnv, addLine, getEnvPersistent, loadPersistedFilesIntoWorker]);

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

    if (getEnvPersistent(targetId)) {
      saveFileToDB(targetId, path, content).catch(() => {});
    }
  }, [activeEnvId, getWorkerState, getEnvPersistent]);

  const deleteFile = useCallback((path: string, envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker) return;
    ws.worker.postMessage({ type: "delete-file", path });

    if (getEnvPersistent(targetId)) {
      deleteFileFromDB(targetId, path).catch(() => {});
    }
  }, [activeEnvId, getWorkerState, getEnvPersistent]);

  const renameFile = useCallback((oldPath: string, newPath: string, envId?: string) => {
    const targetId = envId || activeEnvId;
    const ws = getWorkerState(targetId);
    if (!ws.worker) return;
    ws.worker.postMessage({ type: "rename-file", path: oldPath, newPath });

    if (getEnvPersistent(targetId)) {
      renameFileInDB(targetId, oldPath, newPath).catch(() => {});
    }
  }, [activeEnvId, getWorkerState, getEnvPersistent]);

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
        persistent: false,
      };
      saveEnvironmentMeta(envToMeta(newEnv)).catch(() => {});
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
        saveActiveEnvToStorage(remaining[0].id);
      }
      deleteEnvironmentMeta(envId).catch(() => {});
      clearEnvironmentFiles(envId).catch(() => {});
      return remaining;
    });
  }, [activeEnvId, destroyWorker]);

  const renameEnvironment = useCallback((envId: string, newName: string) => {
    updateEnv(envId, { name: newName });
    const env = environmentsRef.current.find(e => e.id === envId);
    if (env) {
      saveEnvironmentMeta(envToMeta({ ...env, name: newName })).catch(() => {});
    }
  }, [updateEnv]);

  const switchEnvironment = useCallback((envId: string) => {
    setActiveEnvId(envId);
    saveActiveEnvToStorage(envId);
  }, []);

  const togglePersistence = useCallback(async (envId?: string) => {
    const targetId = envId || activeEnvId;
    const env = environmentsRef.current.find(e => e.id === targetId);
    if (!env) return;

    const newPersistent = !env.persistent;

    if (newPersistent) {
      const ws = getWorkerState(targetId);
      if (ws.worker && ws.statusRef === "ready") {
        addLine(targetId, "system", "Enabling persistence — saving current files to browser storage...");
        try {
          const persistReqId = "persist_" + (++requestIdCounter);
          const result = await new Promise<string>((resolve) => {
            const handler = (e: MessageEvent) => {
              if (e.data.type === "snapshot" && e.data.requestId === persistReqId) {
                ws.worker?.removeEventListener("message", handler);
                resolve(e.data.data);
              }
            };
            ws.worker!.addEventListener("message", handler);
            ws.worker!.postMessage({ type: "save-snapshot", requestId: persistReqId });
            setTimeout(() => {
              ws.worker?.removeEventListener("message", handler);
              resolve("[]");
            }, 5000);
          });

          const parsed = JSON.parse(result) as { path: string; base64_content: string }[];
          const files = parsed.map(f => ({
            path: f.path.replace(/^\/workspace\//, ""),
            content: atob(f.base64_content),
          }));
          await saveAllFilesToDB(targetId, files);
          addLine(targetId, "system", `Saved ${files.length} file(s) to browser storage.`);
        } catch {
          addLine(targetId, "system", "Persistence enabled. Files will be saved on next write.");
        }
      } else {
        addLine(targetId, "system", "Persistence enabled. Files will be saved after runtime is initialized.");
      }
    } else {
      addLine(targetId, "system", "Persistence disabled. Clearing stored files...");
      await clearEnvironmentFiles(targetId).catch(() => {});
      addLine(targetId, "system", "Browser storage cleared for this environment.");
    }

    updateEnv(targetId, { persistent: newPersistent });
    const envNow = environmentsRef.current.find(e => e.id === targetId);
    if (envNow) {
      saveEnvironmentMeta(envToMeta({ ...envNow, persistent: newPersistent })).catch(() => {});
    }
  }, [activeEnvId, getWorkerState, addLine, updateEnv]);

  useEffect(() => {
    if (!restoredFromDB) return;
    for (const env of environmentsRef.current) {
      saveEnvironmentMeta(envToMeta(env)).catch(() => {});
    }
  }, [restoredFromDB]);

  useEffect(() => {
    const workers = workersRef.current;
    return () => {
      workers.forEach((ws) => {
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
    togglePersistence,
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
