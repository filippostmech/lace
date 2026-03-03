import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FilePlus,
  Trash2,
  Pencil,
  FileCode,
  Check,
  X,
  FolderOpen,
} from "lucide-react";
import type { RuntimeStatus } from "@/hooks/use-pyodide";

interface FileExplorerProps {
  files: string[];
  activeFile: string | null;
  status: RuntimeStatus;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
}

export function FileExplorer({
  files,
  activeFile,
  status,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
}: FileExplorerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const isReady = status === "ready";

  const handleCreate = () => {
    const name = newFileName.trim();
    if (name && !files.includes(name)) {
      onCreateFile(name);
      setNewFileName("");
      setIsCreating(false);
    }
  };

  const handleRename = (oldPath: string) => {
    const name = renameValue.trim();
    if (name && name !== oldPath && !files.includes(name)) {
      onRenameFile(oldPath, name);
    }
    setRenamingFile(null);
    setRenameValue("");
  };

  const startRename = (path: string) => {
    setRenamingFile(path);
    setRenameValue(path);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]" data-testid="file-explorer">
      <div className="flex items-center justify-between gap-1 px-3 py-2 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground tracking-wide uppercase">
            Files
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="w-6 h-6"
          disabled={!isReady}
          onClick={() => {
            setIsCreating(true);
            setNewFileName("");
          }}
          data-testid="button-new-file"
        >
          <FilePlus className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {isCreating && (
            <div className="flex items-center gap-1 px-1.5 py-1 mb-1">
              <FileCode className="w-3.5 h-3.5 text-[hsl(88,50.4%,52.5%)] shrink-0" />
              <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setIsCreating(false);
                }}
                placeholder="filename.py"
                className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none border-b border-[hsl(88,50.4%,52.5%)] pb-0.5 min-w-0"
                data-testid="input-new-filename"
              />
              <button
                onClick={handleCreate}
                className="text-[hsl(88,50.4%,52.5%)] p-0.5"
                data-testid="button-confirm-create"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="text-muted-foreground p-0.5"
                data-testid="button-cancel-create"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {files.length === 0 && !isCreating && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground select-none">
              <FileCode className="w-6 h-6 opacity-20 mb-2" />
              <span className="text-[10px] tracking-wider uppercase opacity-40">
                {isReady ? "No files yet" : "Init runtime"}
              </span>
            </div>
          )}

          {files.map((file) => (
            <div
              key={file}
              className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-sm cursor-pointer transition-colors ${
                activeFile === file
                  ? "bg-[#1a1a1a] text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => {
                if (renamingFile !== file) onSelectFile(file);
              }}
              data-testid={`file-item-${file}`}
            >
              <FileCode
                className={`w-3.5 h-3.5 shrink-0 ${
                  activeFile === file
                    ? "text-[hsl(88,50.4%,52.5%)]"
                    : "text-muted-foreground"
                }`}
              />

              {renamingFile === file ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(file);
                      if (e.key === "Escape") {
                        setRenamingFile(null);
                        setRenameValue("");
                      }
                    }}
                    className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none border-b border-[hsl(88,50.4%,52.5%)] pb-0.5 min-w-0"
                    data-testid={`input-rename-${file}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRename(file);
                    }}
                    className="text-[hsl(88,50.4%,52.5%)] p-0.5"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingFile(null);
                    }}
                    className="text-muted-foreground p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-mono truncate flex-1">
                    {file}
                  </span>
                  <div className="flex items-center gap-0.5 invisible group-hover:visible">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(file);
                      }}
                      className="text-muted-foreground p-0.5 rounded-sm transition-colors"
                      data-testid={`button-rename-${file}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file);
                      }}
                      className="text-muted-foreground p-0.5 rounded-sm transition-colors"
                      data-testid={`button-delete-${file}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
