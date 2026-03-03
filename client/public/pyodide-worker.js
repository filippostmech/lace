let pyodide = null;

self.onmessage = async function (e) {
  const { type, code, snapshot } = e.data;

  if (type === "init") {
    try {
      self.postMessage({ type: "status", status: "loading" });
      importScripts("https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js");
      pyodide = await loadPyodide({
        stdout: (text) => {
          self.postMessage({ type: "stdout", text });
        },
        stderr: (text) => {
          self.postMessage({ type: "stderr", text });
        },
      });
      pyodide.runPython(`
import os
os.makedirs('/workspace', exist_ok=True)
`);
      self.postMessage({ type: "status", status: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", text: "Failed to initialize Pyodide: " + err.message });
    }
  }

  if (type === "run") {
    if (!pyodide) {
      self.postMessage({ type: "error", text: "Runtime not initialized" });
      return;
    }
    try {
      self.postMessage({ type: "status", status: "running" });
      await pyodide.runPythonAsync(code);
      self.postMessage({ type: "status", status: "done" });
    } catch (err) {
      self.postMessage({ type: "stderr", text: err.message });
      self.postMessage({ type: "status", status: "done" });
    }
  }

  if (type === "save-snapshot") {
    if (!pyodide) {
      self.postMessage({ type: "error", text: "Runtime not initialized" });
      return;
    }
    try {
      const result = pyodide.runPython(`
import os, base64, json

def collect_files(root):
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        for f in filenames:
            full = os.path.join(dirpath, f)
            with open(full, 'rb') as fh:
                data = base64.b64encode(fh.read()).decode('ascii')
            files.append({"path": full, "base64_content": data})
    return files

json.dumps(collect_files('/workspace'))
`);
      self.postMessage({ type: "snapshot", data: result });
    } catch (err) {
      self.postMessage({ type: "error", text: "Snapshot failed: " + err.message });
    }
  }

  if (type === "load-snapshot") {
    if (!pyodide) {
      self.postMessage({ type: "error", text: "Runtime not initialized" });
      return;
    }
    try {
      pyodide.globals.set("__snapshot_json__", snapshot);
      pyodide.runPython(`
import os, base64, json

data = json.loads(__snapshot_json__)
for entry in data:
    path = entry["path"]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(base64.b64decode(entry["base64_content"]))
del __snapshot_json__
`);
      self.postMessage({ type: "status", status: "snapshot-loaded" });
    } catch (err) {
      self.postMessage({ type: "error", text: "Load snapshot failed: " + err.message });
    }
  }
};
