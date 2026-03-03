import { useState, useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Toolbar } from "@/components/toolbar";
import { TerminalOutput } from "@/components/terminal-output";
import { FileExplorer } from "@/components/file-explorer";
import { PackageInstaller } from "@/components/package-installer";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { EnvironmentSwitcher } from "@/components/environment-switcher";
import { useEnvironmentManager } from "@/hooks/use-environment-manager";
import { Terminal, HelpCircle, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_CODE = `# Welcome to LACE - Local Agent Compute Environment
# Write Python code here and click Run (or press Ctrl+Enter)

def greet(name):
    return f"Hello, {name}! Welcome to LACE."

print(greet("World"))
print()

for i in range(5):
    print(f"  {'*' * (2*i+1):^9}")
print("  Python running in your browser!")
`;

export default function LacePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const editorRef = useRef<any>(null);

  const [activeFilePerEnv, setActiveFilePerEnv] = useState<Map<string, string | null>>(new Map());
  const [codePerEnv, setCodePerEnv] = useState<Map<string, string>>(new Map());
  const fileContentsPerEnv = useRef<Map<string, Map<string, string>>>(new Map());

  const {
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
    readFile,
    writeFile,
    deleteFile,
    renameFile,
    installPackage,
    listPackages,
  } = useEnvironmentManager();

  const activeFile = activeFilePerEnv.get(activeEnvId) || null;
  const code = codePerEnv.get(activeEnvId) ?? DEFAULT_CODE;

  const activeFileRef = useRef<string | null>(null);
  const codeRef = useRef(DEFAULT_CODE);
  const runCodeRef = useRef<(code: string) => void>(() => {});
  const activeEnvIdRef = useRef(activeEnvId);

  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { runCodeRef.current = runCode; }, [runCode]);
  useEffect(() => { activeEnvIdRef.current = activeEnvId; }, [activeEnvId]);

  const setActiveFile = useCallback((file: string | null) => {
    setActiveFilePerEnv(prev => {
      const next = new Map(prev);
      next.set(activeEnvIdRef.current, file);
      return next;
    });
  }, []);

  const setCode = useCallback((newCode: string) => {
    setCodePerEnv(prev => {
      const next = new Map(prev);
      next.set(activeEnvIdRef.current, newCode);
      return next;
    });
  }, []);

  const getFileContents = useCallback((envId: string): Map<string, string> => {
    if (!fileContentsPerEnv.current.has(envId)) {
      fileContentsPerEnv.current.set(envId, new Map());
    }
    return fileContentsPerEnv.current.get(envId)!;
  }, []);

  const handleRun = useCallback(() => {
    const currentFile = activeFileRef.current;
    const currentCode = codeRef.current;
    if (currentFile) {
      writeFile(currentFile, currentCode);
    }
    runCodeRef.current(currentCode);
  }, [writeFile]);

  const handleSelectFile = useCallback(
    async (path: string) => {
      const envId = activeEnvIdRef.current;
      const prevFile = activeFileRef.current;
      const prevCode = codeRef.current;
      const cache = getFileContents(envId);

      if (prevFile && prevFile !== path) {
        cache.set(prevFile, prevCode);
        writeFile(prevFile, prevCode);
      }

      if (cache.has(path)) {
        setCode(cache.get(path) || "");
        setActiveFile(path);
        return;
      }

      const content = await readFile(path);
      cache.set(path, content);
      setCode(content);
      setActiveFile(path);
    },
    [readFile, writeFile, getFileContents, setCode, setActiveFile]
  );

  useEffect(() => {
    const envFiles = activeEnv?.files || [];
    if (envFiles.length > 0 && !activeFileRef.current) {
      const main = envFiles.find((f) => f === "main.py");
      if (main) {
        handleSelectFile(main);
      }
    }
  }, [activeEnv?.files, handleSelectFile]);

  const handleCreateFile = useCallback(
    (path: string) => {
      const initial = path.endsWith(".py") ? `# ${path}\n` : "";
      writeFile(path, initial);
      const cache = getFileContents(activeEnvIdRef.current);
      cache.set(path, initial);
      setCode(initial);
      setActiveFile(path);
    },
    [writeFile, getFileContents, setCode, setActiveFile]
  );

  const handleDeleteFile = useCallback(
    (path: string) => {
      deleteFile(path);
      const cache = getFileContents(activeEnvIdRef.current);
      cache.delete(path);
      if (activeFileRef.current === path) {
        setActiveFile(null);
        setCode(DEFAULT_CODE);
      }
    },
    [deleteFile, getFileContents, setCode, setActiveFile]
  );

  const handleRenameFile = useCallback(
    (oldPath: string, newPath: string) => {
      const cache = getFileContents(activeEnvIdRef.current);
      const content = cache.get(oldPath) || "";
      cache.delete(oldPath);
      cache.set(newPath, content);
      renameFile(oldPath, newPath);
      if (activeFileRef.current === oldPath) {
        setActiveFile(newPath);
      }
    },
    [renameFile, getFileContents, setActiveFile]
  );

  const handleEditorMount = useCallback(
    (editor: any) => {
      editorRef.current = editor;
      editor.addAction({
        id: "run-code",
        label: "Run Code",
        keybindings: [2048 | 3],
        run: () => {
          const val = editor.getValue();
          runCodeRef.current(val);
        },
      });
    },
    []
  );

  const handleSwitchEnv = useCallback((envId: string) => {
    const prevFile = activeFileRef.current;
    const prevCode = codeRef.current;
    const prevEnvId = activeEnvIdRef.current;

    if (prevFile) {
      const cache = getFileContents(prevEnvId);
      cache.set(prevFile, prevCode);
    }

    switchEnvironment(envId);
  }, [switchEnvironment, getFileContents]);

  const handleCreateEnv = useCallback(() => {
    const id = createEnvironment();
    switchEnvironment(id);
  }, [createEnvironment, switchEnvironment]);

  const handleRemoveEnv = useCallback((envId: string) => {
    removeEnvironment(envId);
    setActiveFilePerEnv(prev => { const next = new Map(prev); next.delete(envId); return next; });
    setCodePerEnv(prev => { const next = new Map(prev); next.delete(envId); return next; });
    fileContentsPerEnv.current.delete(envId);
  }, [removeEnvironment]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setShowShortcuts((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const currentFile = activeFileRef.current;
        if (currentFile) {
          const val = editorRef.current?.getValue() || codeRef.current;
          writeFile(currentFile, val);
        }
        saveSnapshot();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveSnapshot, writeFile]);

  const displayFileName = activeFile || "untitled";
  const status = activeEnv?.status || "idle";
  const lines = activeEnv?.lines || [];
  const files = activeEnv?.files || [];
  const installedPackages = activeEnv?.installedPackages || [];
  const installingPackage = activeEnv?.installingPackage || null;

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="lace-page">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[hsl(88,50.4%,52.5%)] text-black font-bold text-sm select-none">
            L
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-foreground" data-testid="text-title">
              LACE
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
              Local Agent Compute Environment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono tracking-wider hidden sm:inline">
            Pyodide/WASM &bull; Python 3.11 &bull; {environments.length} env{environments.length !== 1 ? "s" : ""}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7"
            onClick={() => setShowShortcuts(true)}
            data-testid="button-help"
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <EnvironmentSwitcher
        environments={environments}
        activeEnvId={activeEnvId}
        onSwitch={handleSwitchEnv}
        onCreate={handleCreateEnv}
        onRemove={handleRemoveEnv}
        onRename={renameEnvironment}
      />

      <Toolbar
        status={status}
        envName={activeEnv?.name}
        envColor={activeEnv?.color}
        onInit={() => initRuntime()}
        onRun={handleRun}
        onStop={() => stopExecution()}
        onClear={() => clearTerminal()}
        onSaveSnapshot={() => saveSnapshot()}
        onLoadSnapshot={(json) => loadSnapshot(json)}
      />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {sidebarOpen && (
            <>
              <ResizablePanel defaultSize={16} minSize={12} maxSize={25}>
                <div className="flex flex-col h-full">
                  <FileExplorer
                    files={files}
                    activeFile={activeFile}
                    status={status}
                    onSelectFile={handleSelectFile}
                    onCreateFile={handleCreateFile}
                    onDeleteFile={handleDeleteFile}
                    onRenameFile={handleRenameFile}
                  />
                  <PackageInstaller
                    status={status}
                    installedPackages={installedPackages}
                    installingPackage={installingPackage}
                    onInstall={installPackage}
                    onRefresh={listPackages}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle className="w-[3px] bg-[#262626] transition-colors data-[resize-handle-active]:bg-[hsl(88,50.4%,52.5%)]" />
            </>
          )}

          <ResizablePanel defaultSize={sidebarOpen ? 52 : 60} minSize={30}>
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#262626] bg-[#0a0a0a]">
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-6 h-6 shrink-0"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  data-testid="button-toggle-sidebar"
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <PanelLeft className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </Button>
                <div
                  className="w-2.5 h-2.5 rounded-full opacity-60 shrink-0"
                  style={{ backgroundColor: activeEnv?.color || "hsl(88,50.4%,52.5%)" }}
                />
                <span className="text-xs font-mono text-muted-foreground tracking-wide truncate">
                  {displayFileName}
                </span>
                {status === "running" && (
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(253.5,100%,75%)] animate-pulse" />
                    <span className="text-[10px] font-mono text-[hsl(253.5,100%,75%)]">
                      executing
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1" data-testid="editor-container">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  value={code}
                  onChange={(val) => setCode(val ?? "")}
                  onMount={handleEditorMount}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    padding: { top: 16, bottom: 16 },
                    lineNumbersMinChars: 3,
                    renderLineHighlight: "gutter",
                    cursorBlinking: "smooth",
                    cursorSmoothCaretAnimation: "on",
                    smoothScrolling: true,
                    bracketPairColorization: { enabled: true },
                    automaticLayout: true,
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                    scrollbar: {
                      verticalScrollbarSize: 6,
                      horizontalScrollbarSize: 6,
                    },
                  }}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-[3px] bg-[#262626] transition-colors data-[resize-handle-active]:bg-[hsl(88,50.4%,52.5%)]" />

          <ResizablePanel defaultSize={sidebarOpen ? 32 : 40} minSize={20}>
            <div className="flex flex-col h-full bg-[#0a0a0a]">
              <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#262626]">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground tracking-wide">
                  output
                </span>
                {status === "running" && (
                  <div className="flex items-center gap-1 ml-2">
                    <span className="inline-block w-1 h-3 bg-[hsl(253.5,100%,75%)] animate-pulse rounded-full" />
                    <span className="inline-block w-1 h-3 bg-[hsl(253.5,100%,75%)] animate-pulse rounded-full [animation-delay:150ms]" />
                    <span className="inline-block w-1 h-3 bg-[hsl(253.5,100%,75%)] animate-pulse rounded-full [animation-delay:300ms]" />
                  </div>
                )}
                {lines.length > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground ml-auto opacity-50">
                    {lines.length} lines
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <TerminalOutput lines={lines} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
