import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  Trash2,
  Download,
  Upload,
  Cpu,
  Loader2,
} from "lucide-react";
import type { RuntimeStatus } from "@/hooks/use-pyodide";

interface ToolbarProps {
  status: RuntimeStatus;
  envName?: string;
  envColor?: string;
  onInit: () => void;
  onRun: () => void;
  onStop: () => void;
  onClear: () => void;
  onSaveSnapshot: () => void;
  onLoadSnapshot: (json: string) => void;
}

const statusConfig: Record<RuntimeStatus, { label: string; color: string }> = {
  idle: { label: "Offline", color: "bg-muted-foreground" },
  loading: { label: "Loading", color: "bg-yellow-500" },
  ready: { label: "Ready", color: "bg-[hsl(88,50.4%,52.5%)]" },
  running: { label: "Running", color: "bg-[hsl(253.5,100%,75%)]" },
  error: { label: "Error", color: "bg-red-500" },
};

export function Toolbar({
  status,
  envName,
  envColor,
  onInit,
  onRun,
  onStop,
  onClear,
  onSaveSnapshot,
  onLoadSnapshot,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onLoadSnapshot(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const isReady = status === "ready";
  const isRunning = status === "running";
  const { label, color } = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#262626] flex-wrap">
      <div className="flex items-center gap-2 mr-3">
        {envColor && (
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: envColor }}
          />
        )}
        <div className={`w-2 h-2 rounded-full ${color} ${status === "running" ? "animate-pulse" : ""}`} />
        <Badge variant="outline" className="text-xs font-mono tracking-wide border-[#262626] text-muted-foreground" data-testid="badge-status">
          {label}
        </Badge>
        {envName && (
          <span className="text-[10px] font-mono text-muted-foreground tracking-wide truncate max-w-[120px] hidden sm:inline" data-testid="text-env-name">
            {envName}
          </span>
        )}
      </div>

      <div className="w-px h-5 bg-[#262626] mr-1" />

      <Button
        size="sm"
        variant={status === "idle" || status === "error" ? "default" : "outline"}
        onClick={onInit}
        disabled={status === "loading"}
        data-testid="button-init"
      >
        {status === "loading" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Cpu className="w-3.5 h-3.5" />
        )}
        <span className="ml-1.5">{status === "loading" ? "Loading..." : "Init"}</span>
      </Button>

      <Button
        size="sm"
        variant="default"
        onClick={onRun}
        disabled={!isReady}
        data-testid="button-run"
      >
        <Play className="w-3.5 h-3.5" />
        <span className="ml-1.5">Run</span>
      </Button>

      <Button
        size="sm"
        variant="destructive"
        onClick={onStop}
        disabled={!isRunning}
        data-testid="button-stop"
      >
        <Square className="w-3.5 h-3.5" />
        <span className="ml-1.5">Stop</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onClear}
        data-testid="button-clear"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="ml-1.5">Clear</span>
      </Button>

      <div className="w-px h-5 bg-[#262626] mx-1" />

      <Button
        size="sm"
        variant="outline"
        onClick={onSaveSnapshot}
        disabled={!isReady}
        data-testid="button-save-snapshot"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="ml-1.5">Save</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={!isReady}
        data-testid="button-load-snapshot"
      >
        <Upload className="w-3.5 h-3.5" />
        <span className="ml-1.5">Load</span>
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileLoad}
        data-testid="input-snapshot-file"
      />
    </div>
  );
}
