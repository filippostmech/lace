import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  HardDrive,
  Eye,
  EyeOff,
  Download,
  Trash2,
  RefreshCw,
  FileText,
  Loader2,
} from "lucide-react";
import type { Environment } from "@/hooks/use-environment-manager";
import {
  getStorageStats,
  getFilesWithSizes,
  getTotalStorageSize,
  getFileContent,
  loadAllFilesFromDB,
  type EnvStorageStats,
  type FileInfo,
} from "@/lib/persistence";

interface StorageManagerProps {
  open: boolean;
  onClose: () => void;
  environments: Environment[];
  onClearEnvStorage: (envId: string) => void;
  onClearAllStorage: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StorageManager({
  open,
  onClose,
  environments,
  onClearEnvStorage,
  onClearAllStorage,
}: StorageManagerProps) {
  const [stats, setStats] = useState<EnvStorageStats[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedEnv, setExpandedEnv] = useState<string | null>(null);
  const [envFiles, setEnvFiles] = useState<FileInfo[]>([]);
  const [previewFile, setPreviewFile] = useState<{ envId: string; path: string; content: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([getStorageStats(), getTotalStorageSize()]);
      setStats(s);
      setTotalSize(t);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      setExpandedEnv(null);
      setPreviewFile(null);
      setConfirmClear(null);
      setConfirmClearAll(false);
    }
  }, [open, refresh]);

  const handleViewFiles = useCallback(async (envId: string) => {
    if (expandedEnv === envId) {
      setExpandedEnv(null);
      setEnvFiles([]);
      setPreviewFile(null);
      return;
    }
    setLoadingFiles(true);
    setExpandedEnv(envId);
    setPreviewFile(null);
    try {
      const files = await getFilesWithSizes(envId);
      setEnvFiles(files);
    } catch {
      setEnvFiles([]);
    }
    setLoadingFiles(false);
  }, [expandedEnv]);

  const handlePreview = useCallback(async (envId: string, path: string) => {
    if (previewFile?.envId === envId && previewFile?.path === path) {
      setPreviewFile(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const content = await getFileContent(envId, path);
      setPreviewFile({ envId, path, content: content ?? "" });
    } catch {
      setPreviewFile({ envId, path, content: "(failed to load)" });
    }
    setLoadingPreview(false);
  }, [previewFile]);

  const handleExport = useCallback(async (envId: string) => {
    try {
      const files = await loadAllFilesFromDB(envId);
      const env = environments.find(e => e.id === envId);
      const envName = env?.name || "env";
      const data = JSON.stringify(files, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = envName.replace(/[^a-zA-Z0-9-_]/g, "_");
      a.download = `lace-storage-${safeName}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }, [environments]);

  const handleClearEnv = useCallback(async (envId: string) => {
    onClearEnvStorage(envId);
    setConfirmClear(null);
    if (expandedEnv === envId) {
      setExpandedEnv(null);
      setEnvFiles([]);
      setPreviewFile(null);
    }
    setTimeout(() => refresh(), 200);
  }, [onClearEnvStorage, expandedEnv, refresh]);

  const handleClearAll = useCallback(async () => {
    onClearAllStorage();
    setConfirmClearAll(false);
    setExpandedEnv(null);
    setEnvFiles([]);
    setPreviewFile(null);
    setTimeout(() => refresh(), 200);
  }, [onClearAllStorage, refresh]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="storage-manager-overlay"
    >
      <div
        className="bg-[#1a1a1a] border border-[#262626] rounded-lg max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626] shrink-0">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-[hsl(88,50.4%,52.5%)]" />
            <h2 className="text-sm font-semibold text-foreground tracking-wide">
              Browser Storage
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-[#262626] text-muted-foreground"
              data-testid="text-total-storage"
            >
              {loading ? "..." : formatBytes(totalSize)}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={refresh}
              className="w-6 h-6"
              disabled={loading}
              data-testid="button-refresh-storage"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="w-6 h-6"
              data-testid="button-close-storage"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {environments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No environments found.</p>
          ) : (
            <div className="space-y-1">
              {environments.map((env) => {
                const envStats = stats.find(s => s.envId === env.id);
                const fileCount = envStats?.fileCount || 0;
                const envSize = envStats?.totalBytes || 0;
                const isExpanded = expandedEnv === env.id;

                return (
                  <div key={env.id} data-testid={`storage-env-row-${env.id}`}>
                    <div className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-[#222]">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: env.color }}
                      />
                      <span className="text-xs font-mono text-foreground truncate max-w-[120px]">
                        {env.name}
                      </span>

                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono border-[#333] ${
                          env.persistent
                            ? "text-[hsl(88,50.4%,52.5%)] border-[hsl(88,50.4%,52.5%)]/30"
                            : "text-muted-foreground"
                        }`}
                      >
                        {env.persistent ? "Persisted" : "Not persisted"}
                      </Badge>

                      <span
                        className="text-[10px] font-mono text-muted-foreground ml-auto shrink-0"
                        data-testid={`text-env-file-count-${env.id}`}
                      >
                        {fileCount > 0 ? `${fileCount} file${fileCount !== 1 ? "s" : ""} · ${formatBytes(envSize)}` : "No files stored"}
                      </span>

                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-6 h-6"
                          onClick={() => handleViewFiles(env.id)}
                          disabled={fileCount === 0}
                          data-testid={`button-view-files-${env.id}`}
                        >
                          {isExpanded ? (
                            <EyeOff className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <Eye className="w-3 h-3 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-6 h-6"
                          onClick={() => handleExport(env.id)}
                          disabled={fileCount === 0}
                          data-testid={`button-export-storage-${env.id}`}
                        >
                          <Download className="w-3 h-3 text-muted-foreground" />
                        </Button>

                        {confirmClear === env.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <span className="text-[10px] text-red-400 font-mono">Clear?</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-red-400"
                              onClick={() => handleClearEnv(env.id)}
                              data-testid={`button-confirm-clear-${env.id}`}
                            >
                              Yes
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground"
                              onClick={() => setConfirmClear(null)}
                              data-testid={`button-cancel-clear-${env.id}`}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-6 h-6"
                            onClick={() => setConfirmClear(env.id)}
                            disabled={fileCount === 0}
                            data-testid={`button-clear-storage-${env.id}`}
                          >
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="ml-5 pl-3 border-l border-[#333] mb-2">
                        {loadingFiles ? (
                          <div className="flex items-center gap-2 py-2">
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Loading files...</span>
                          </div>
                        ) : envFiles.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground py-2">No files.</p>
                        ) : (
                          <div className="space-y-0.5 py-1">
                            {envFiles.map((file) => (
                              <div key={file.path}>
                                <button
                                  className="flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-[#262626] transition-colors"
                                  onClick={() => handlePreview(env.id, file.path)}
                                  data-testid={`button-preview-file-${file.path}`}
                                >
                                  <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="text-[11px] font-mono text-foreground truncate">
                                    {file.path}
                                  </span>
                                  <span className="text-[9px] font-mono text-muted-foreground ml-auto shrink-0">
                                    {formatBytes(file.sizeBytes)}
                                  </span>
                                </button>
                                {previewFile?.envId === env.id && previewFile?.path === file.path && (
                                  <div className="mt-1 mb-2 mx-2">
                                    {loadingPreview ? (
                                      <div className="flex items-center gap-2 py-2">
                                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                      </div>
                                    ) : (
                                      <pre className="text-[10px] font-mono text-muted-foreground bg-[#111] border border-[#262626] rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-all">
                                        {previewFile.content}
                                      </pre>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[#262626] shrink-0">
          {confirmClearAll ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 font-mono">Clear all storage?</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-red-400"
                onClick={handleClearAll}
                data-testid="button-confirm-clear-all"
              >
                Yes, clear all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={() => setConfirmClearAll(false)}
                data-testid="button-cancel-clear-all"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-red-400 border-red-400/30 hover:bg-red-400/10"
              onClick={() => setConfirmClearAll(true)}
              disabled={totalSize === 0}
              data-testid="button-clear-all-storage"
            >
              <Trash2 className="w-3 h-3 mr-1.5" />
              Clear All Storage
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">
            IndexedDB · lace-persistence
          </span>
        </div>
      </div>
    </div>
  );
}
