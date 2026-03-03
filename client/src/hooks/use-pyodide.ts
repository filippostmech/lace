import { useState, useRef, useCallback } from "react";

export type RuntimeStatus = "idle" | "loading" | "ready" | "running" | "error";

export interface TerminalLine {
  id: number;
  type: "stdout" | "stderr" | "system";
  text: string;
  timestamp: number;
}

let lineIdCounter = 0;

export function usePyodide() {
  const [status, setStatus] = useState<RuntimeStatus>("idle");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, []);

  const initRuntime = useCallback(() => {
    destroyWorker();
    setStatus("loading");
    addLine("system", "Initializing Pyodide runtime...");

    const worker = new Worker("/pyodide-worker.js");
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, text, status: s, data } = e.data;

      if (type === "stdout") {
        addLine("stdout", text);
      } else if (type === "stderr") {
        addLine("stderr", text);
      } else if (type === "error") {
        addLine("stderr", text);
        setStatus("error");
      } else if (type === "status") {
        if (s === "ready") {
          setStatus("ready");
          addLine("system", "Runtime ready. Python 3.11 (Pyodide/WASM)");
        } else if (s === "running") {
          setStatus("running");
        } else if (s === "done") {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setStatus("ready");
        } else if (s === "snapshot-loaded") {
          addLine("system", "Snapshot loaded successfully.");
        }
      } else if (type === "snapshot") {
        try {
          const blob = new Blob([data], { type: "application/json" });
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
      }
    };

    worker.onerror = () => {
      addLine("stderr", "Worker error occurred.");
      setStatus("error");
    };

    worker.postMessage({ type: "init" });
  }, [destroyWorker, addLine]);

  const runCode = useCallback(
    (code: string, timeout = 10000) => {
      if (!workerRef.current || status !== "ready") return;

      workerRef.current.postMessage({ type: "run", code });

      timeoutRef.current = setTimeout(() => {
        addLine("stderr", `Execution timed out after ${timeout / 1000}s. Worker terminated.`);
        destroyWorker();
        setStatus("idle");
        addLine("system", "Runtime terminated. Re-initialize to continue.");
      }, timeout);
    },
    [status, addLine, destroyWorker]
  );

  const stopExecution = useCallback(() => {
    if (workerRef.current) {
      addLine("system", "Execution stopped. Worker terminated.");
      destroyWorker();
      setStatus("idle");
      addLine("system", "Runtime terminated. Re-initialize to continue.");
    }
  }, [destroyWorker, addLine]);

  const saveSnapshot = useCallback(() => {
    if (!workerRef.current || status !== "ready") return;
    workerRef.current.postMessage({ type: "save-snapshot" });
  }, [status]);

  const loadSnapshot = useCallback(
    (jsonString: string) => {
      if (!workerRef.current || status !== "ready") return;
      workerRef.current.postMessage({ type: "load-snapshot", snapshot: jsonString });
    },
    [status]
  );

  return {
    status,
    lines,
    initRuntime,
    runCode,
    stopExecution,
    clearTerminal,
    saveSnapshot,
    loadSnapshot,
  };
}
