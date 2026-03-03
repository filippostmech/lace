import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Toolbar } from "@/components/toolbar";
import { TerminalOutput } from "@/components/terminal-output";
import { usePyodide } from "@/hooks/use-pyodide";
import { Terminal } from "lucide-react";

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
  const [code, setCode] = useState(DEFAULT_CODE);
  const {
    status,
    lines,
    initRuntime,
    runCode,
    stopExecution,
    clearTerminal,
    saveSnapshot,
    loadSnapshot,
  } = usePyodide();

  const handleRun = useCallback(() => {
    runCode(code);
  }, [code, runCode]);

  const handleEditorMount = useCallback((editor: any) => {
    editor.addAction({
      id: "run-code",
      label: "Run Code",
      keybindings: [2048 | 3],
      run: () => {
        if (status === "ready") {
          runCode(editor.getValue());
        }
      },
    });
  }, [status, runCode]);

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="lace-page">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[hsl(88,50.4%,52.5%)] text-black font-bold text-sm">
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
          <span className="text-[10px] text-muted-foreground font-mono tracking-wider">
            Pyodide/WASM • Python 3.11 • Offline
          </span>
        </div>
      </header>

      <Toolbar
        status={status}
        onInit={initRuntime}
        onRun={handleRun}
        onStop={stopExecution}
        onClear={clearTerminal}
        onSaveSnapshot={saveSnapshot}
        onLoadSnapshot={loadSnapshot}
      />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#262626] bg-[#0a0a0a]">
                <div className="w-3 h-3 rounded-full bg-[hsl(88,50.4%,52.5%)] opacity-60" />
                <span className="text-xs font-mono text-muted-foreground tracking-wide">
                  main.py
                </span>
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

          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="flex flex-col h-full bg-[#0a0a0a]">
              <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#262626]">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground tracking-wide">
                  output
                </span>
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
    </div>
  );
}
