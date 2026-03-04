import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  X,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Trash2,
  Radio,
} from "lucide-react";
import type { ConnectionStatus, JobSummary } from "@/lib/job-executor";

interface JobsPanelProps {
  open: boolean;
  onClose: () => void;
  connectionStatus: ConnectionStatus;
  recentJobs: JobSummary[];
  activeJobCount: number;
  hostUrl: string;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function StatusIcon({ status }: { status: JobSummary["status"] }) {
  switch (status) {
    case "queued":
      return <Clock className="w-3 h-3 text-yellow-400" />;
    case "running":
      return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="w-3 h-3 text-[hsl(88,50.4%,52.5%)]" />;
    case "failed":
      return <XCircle className="w-3 h-3 text-red-400" />;
    case "timeout":
      return <Clock className="w-3 h-3 text-orange-400" />;
  }
}

function statusColor(status: JobSummary["status"]): string {
  switch (status) {
    case "queued": return "text-yellow-400 border-yellow-400/30";
    case "running": return "text-blue-400 border-blue-400/30";
    case "completed": return "text-[hsl(88,50.4%,52.5%)] border-[hsl(88,50.4%,52.5%)]/30";
    case "failed": return "text-red-400 border-red-400/30";
    case "timeout": return "text-orange-400 border-orange-400/30";
  }
}

export function JobsPanel({
  open,
  onClose,
  connectionStatus,
  recentJobs,
  activeJobCount,
  hostUrl,
  onConnect,
  onDisconnect,
}: JobsPanelProps) {
  const [urlInput, setUrlInput] = useState(hostUrl);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  if (!open) return null;

  const connectionIcon =
    connectionStatus === "connected" ? (
      <Wifi className="w-4 h-4 text-[hsl(88,50.4%,52.5%)]" />
    ) : connectionStatus === "connecting" ? (
      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
    ) : (
      <WifiOff className="w-4 h-4 text-muted-foreground" />
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="jobs-panel-overlay"
    >
      <div
        className="bg-[#111] border border-[#262626] rounded-xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626] shrink-0">
          <div className="flex items-center gap-3">
            <Radio className="w-4 h-4 text-[hsl(253.5,100%,75%)]" />
            <span className="text-sm font-semibold text-foreground font-mono">
              Agent Jobs
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-mono ${
                connectionStatus === "connected"
                  ? "text-[hsl(88,50.4%,52.5%)] border-[hsl(88,50.4%,52.5%)]/30"
                  : connectionStatus === "connecting"
                  ? "text-yellow-400 border-yellow-400/30"
                  : "text-muted-foreground border-[#333]"
              }`}
              data-testid="text-agent-connection-status"
            >
              {connectionIcon}
              <span className="ml-1">
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
              </span>
            </Badge>
            {activeJobCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-blue-400 border-blue-400/30"
                data-testid="text-active-jobs"
              >
                {activeJobCount} active
              </Badge>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6"
            onClick={onClose}
            data-testid="button-close-jobs"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>

        <div className="px-5 py-3 border-b border-[#262626] shrink-0">
          <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2 block">
            Host URL
          </label>
          <div className="flex items-center gap-2">
            <Input
              className="h-7 text-xs font-mono bg-[#0a0a0a] border-[#333] text-foreground"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="ws://127.0.0.1:8080/ws"
              data-testid="input-host-url"
            />
            {connectionStatus === "connected" ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs border-[#333] text-muted-foreground"
                onClick={onDisconnect}
                data-testid="button-disconnect"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs border-[hsl(88,50.4%,52.5%)]/30 text-[hsl(88,50.4%,52.5%)]"
                onClick={() => onConnect(urlInput)}
                disabled={connectionStatus === "connecting"}
                data-testid="button-connect"
              >
                Connect
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3">
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Radio className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-xs font-mono">No jobs yet</p>
              <p className="text-[10px] font-mono mt-1 opacity-60">
                Jobs submitted via the API will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentJobs.map((job) => {
                const isExpanded = expandedJob === job.id;
                const duration = job.completedAt
                  ? job.completedAt - job.startedAt
                  : Date.now() - job.startedAt;

                return (
                  <div key={job.id} data-testid={`job-row-${job.id}`}>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-left"
                      onClick={() =>
                        setExpandedJob(isExpanded ? null : job.id)
                      }
                      data-testid={`button-expand-job-${job.id}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                      <StatusIcon status={job.status} />
                      <span className="text-[11px] font-mono text-foreground truncate">
                        {job.id}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono ml-auto shrink-0 ${statusColor(job.status)}`}
                      >
                        {job.status}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {formatDuration(duration)}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {formatTime(job.startedAt)}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="ml-6 mr-2 mb-2 space-y-2">
                        {job.error && (
                          <div className="bg-red-400/5 border border-red-400/20 rounded-md px-3 py-2">
                            <span className="text-[10px] font-mono text-red-400">
                              {job.error}
                            </span>
                          </div>
                        )}
                        {job.stdout && (
                          <div>
                            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                              stdout
                            </span>
                            <pre className="mt-1 bg-[#0a0a0a] border border-[#262626] rounded-md px-3 py-2 text-[11px] font-mono text-foreground overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                              {job.stdout}
                            </pre>
                          </div>
                        )}
                        {job.stderr && (
                          <div>
                            <span className="text-[9px] font-mono text-red-400 uppercase tracking-wider">
                              stderr
                            </span>
                            <pre className="mt-1 bg-red-400/5 border border-red-400/20 rounded-md px-3 py-2 text-[11px] font-mono text-red-300 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                              {job.stderr}
                            </pre>
                          </div>
                        )}
                        {!job.stdout && !job.stderr && !job.error && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            No output
                          </span>
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
          <span className="text-[10px] text-muted-foreground font-mono">
            {recentJobs.length} job{recentJobs.length !== 1 ? "s" : ""} total
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            LACE Host · WebSocket
          </span>
        </div>
      </div>
    </div>
  );
}
