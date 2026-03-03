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
import os, sys
os.makedirs('/workspace', exist_ok=True)
if '/workspace' not in sys.path:
    sys.path.insert(0, '/workspace')
`);
      await pyodide.loadPackage("micropip");

      pyodide.runPython(`
import os

files = {
    "main.py": '''# LACE - Local Agent Compute Environment
# This is your main entry point. Press Ctrl+Enter to run!

from utils import banner, fibonacci

banner("LACE Sandbox")

print("First 10 Fibonacci numbers:")
fibs = fibonacci(10)
for i, n in enumerate(fibs):
    print(f"  F({i}) = {n}")

print()
print("Try editing this file or creating new ones!")
''',
    "utils.py": '''"""Utility functions for the LACE sandbox."""


def banner(title: str, width: int = 40) -> None:
    """Print a decorative banner."""
    print("=" * width)
    print(f"{title:^{width}}")
    print("=" * width)
    print()


def fibonacci(n: int) -> list[int]:
    """Return the first n Fibonacci numbers."""
    if n <= 0:
        return []
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq[:n]
''',
    "data_example.py": '''"""Example: working with data structures."""

students = [
    {"name": "Alice", "grade": 92},
    {"name": "Bob", "grade": 85},
    {"name": "Charlie", "grade": 78},
    {"name": "Diana", "grade": 95},
    {"name": "Eve", "grade": 88},
]

print("Student Report")
print("-" * 30)

for s in students:
    bar = "#" * (s["grade"] // 5)
    print(f"  {s['name']:<10} {s['grade']:>3}  {bar}")

avg = sum(s["grade"] for s in students) / len(students)
top = max(students, key=lambda s: s["grade"])

print("-" * 30)
print(f"  Average: {avg:.1f}")
print(f"  Top student: {top['name']} ({top['grade']})")
''',
}

for name, content in files.items():
    path = os.path.join('/workspace', name)
    if not os.path.exists(path):
        with open(path, 'w') as f:
            f.write(content)
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
__read_result__ = ""
with open(__read_path__, 'r') as f:
    __read_result__ = f.read()
__read_result__
`);
      pyodide.runPython("del __read_path__, __read_result__");
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

  if (type === "clear-workspace") {
    if (!pyodide) {
      self.postMessage({ type: "workspace-cleared" });
      return;
    }
    try {
      pyodide.runPython(`
import os, shutil
root = '/workspace'
for item in os.listdir(root):
    full = os.path.join(root, item)
    if os.path.isdir(full):
        shutil.rmtree(full)
    else:
        os.remove(full)
`);
      self.postMessage({ type: "workspace-cleared" });
    } catch (err) {
      self.postMessage({ type: "workspace-cleared" });
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
