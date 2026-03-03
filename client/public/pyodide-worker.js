let pyodide = null;

function sanitizePath(p) {
  if (!p || typeof p !== "string") return null;
  const normalized = p.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) return null;
  if (normalized.trim() === "") return null;
  return normalized;
}

self.onmessage = async function (e) {
  const { type, code, snapshot, path, content, newPath, packageName, requestId } = e.data;

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
      await pyodide.loadPackage("micropip");
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

  if (type === "list-files") {
    if (!pyodide) {
      self.postMessage({ type: "file-list", files: [] });
      return;
    }
    try {
      const result = pyodide.runPython(`
import os, json

def list_workspace():
    files = []
    root = '/workspace'
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        for f in filenames:
            if rel_dir == '.':
                files.append(f)
            else:
                files.append(os.path.join(rel_dir, f))
    return files

json.dumps(list_workspace())
`);
      self.postMessage({ type: "file-list", files: JSON.parse(result) });
    } catch (err) {
      self.postMessage({ type: "file-list", files: [] });
    }
  }

  if (type === "read-file") {
    if (!pyodide) {
      self.postMessage({ type: "file-content", requestId, path, content: "", error: "Runtime not initialized" });
      return;
    }
    const safePath = sanitizePath(path);
    if (!safePath) {
      self.postMessage({ type: "file-content", requestId, path, content: "", error: "Invalid path" });
      return;
    }
    try {
      pyodide.globals.set("__read_path__", "/workspace/" + safePath);
      const result = pyodide.runPython(`
with open(__read_path__, 'r') as f:
    f.read()
`);
      pyodide.globals.delete("__read_path__");
      self.postMessage({ type: "file-content", requestId, path: safePath, content: result });
    } catch (err) {
      self.postMessage({ type: "file-content", requestId, path: safePath, content: "", error: err.message });
    }
  }

  if (type === "write-file") {
    if (!pyodide) {
      self.postMessage({ type: "error", text: "Runtime not initialized" });
      return;
    }
    const safePath = sanitizePath(path);
    if (!safePath) {
      self.postMessage({ type: "error", text: "Invalid file path" });
      return;
    }
    try {
      pyodide.globals.set("__write_path__", "/workspace/" + safePath);
      pyodide.globals.set("__write_content__", content || "");
      pyodide.runPython(`
import os
d = os.path.dirname(__write_path__)
if d:
    os.makedirs(d, exist_ok=True)
with open(__write_path__, 'w') as f:
    f.write(__write_content__)
del __write_path__, __write_content__
`);
      self.postMessage({ type: "file-written", path: safePath });
    } catch (err) {
      self.postMessage({ type: "error", text: "Write failed: " + err.message });
    }
  }

  if (type === "delete-file") {
    if (!pyodide) {
      self.postMessage({ type: "error", text: "Runtime not initialized" });
      return;
    }
    const safePath = sanitizePath(path);
    if (!safePath) {
      self.postMessage({ type: "error", text: "Invalid file path" });
      return;
    }
    try {
      pyodide.globals.set("__del_path__", "/workspace/" + safePath);
      pyodide.runPython(`
import os
if os.path.exists(__del_path__):
    os.remove(__del_path__)
del __del_path__
`);
      self.postMessage({ type: "file-deleted", path: safePath });
    } catch (err) {
      self.postMessage({ type: "error", text: "Delete failed: " + err.message });
    }
  }

  if (type === "rename-file") {
    if (!pyodide) {
      self.postMessage({ type: "error", text: "Runtime not initialized" });
      return;
    }
    const safeOld = sanitizePath(path);
    const safeNew = sanitizePath(newPath);
    if (!safeOld || !safeNew) {
      self.postMessage({ type: "error", text: "Invalid file path" });
      return;
    }
    try {
      pyodide.globals.set("__old_path__", "/workspace/" + safeOld);
      pyodide.globals.set("__new_path__", "/workspace/" + safeNew);
      pyodide.runPython(`
import os
if os.path.exists(__old_path__):
    d = os.path.dirname(__new_path__)
    if d:
        os.makedirs(d, exist_ok=True)
    os.rename(__old_path__, __new_path__)
del __old_path__, __new_path__
`);
      self.postMessage({ type: "file-renamed", oldPath: safeOld, newPath: safeNew });
    } catch (err) {
      self.postMessage({ type: "error", text: "Rename failed: " + err.message });
    }
  }

  if (type === "install-package") {
    if (!pyodide) {
      self.postMessage({ type: "error", text: "Runtime not initialized" });
      return;
    }
    try {
      self.postMessage({ type: "package-status", packageName, status: "installing" });
      pyodide.globals.set("__pkg_name__", packageName);
      await pyodide.runPythonAsync(`
import micropip
await micropip.install(__pkg_name__)
del __pkg_name__
`);
      self.postMessage({ type: "package-status", packageName, status: "installed" });
    } catch (err) {
      self.postMessage({ type: "package-status", packageName, status: "error", error: err.message });
    }
  }

  if (type === "list-packages") {
    if (!pyodide) {
      self.postMessage({ type: "package-list", packages: [] });
      return;
    }
    try {
      const result = pyodide.runPython(`
import micropip, json
pkgs = micropip.list()
json.dumps([{"name": name, "version": str(pkg.version)} for name, pkg in pkgs.items()])
`);
      self.postMessage({ type: "package-list", packages: JSON.parse(result) });
    } catch {
      self.postMessage({ type: "package-list", packages: [] });
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
