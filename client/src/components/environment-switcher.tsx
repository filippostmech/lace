import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { Environment } from "@/hooks/use-environment-manager";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface EnvironmentSwitcherProps {
  environments: Environment[];
  activeEnvId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

const statusDotColor: Record<string, string> = {
  idle: "bg-muted-foreground/50",
  loading: "bg-yellow-500",
  ready: "bg-emerald-500",
  running: "bg-[hsl(253.5,100%,75%)]",
  error: "bg-red-500",
};

export function EnvironmentSwitcher({
  environments,
  activeEnvId,
  onSwitch,
  onCreate,
  onRemove,
  onRename,
}: EnvironmentSwitcherProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = (env: Environment) => {
    setEditingId(env.id);
    setEditValue(env.name);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  return (
    <div className="flex items-center border-b border-[#262626] bg-[#0a0a0a]" data-testid="environment-switcher">
      <ScrollArea className="flex-1">
        <div className="flex items-center gap-0.5 px-2 py-1">
          {environments.map((env) => {
            const isActive = env.id === activeEnvId;
            const dotClass = statusDotColor[env.status] || statusDotColor.idle;

            return (
              <div
                key={env.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-md cursor-pointer select-none transition-colors relative ${
                  isActive
                    ? "bg-[#1A1A1A] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#141414]"
                }`}
                onClick={() => onSwitch(env.id)}
                onDoubleClick={() => startRename(env)}
                data-testid={`env-tab-${env.id}`}
              >
                {isActive && (
                  <div
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ backgroundColor: env.color }}
                  />
                )}

                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${dotClass} ${
                    env.status === "running" ? "animate-pulse" : ""
                  }`}
                />

                {editingId === env.id ? (
                  <input
                    ref={inputRef}
                    className="bg-transparent text-xs font-mono outline-none border-b border-[hsl(88,50.4%,52.5%)] w-24 text-foreground"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`input-rename-env-${env.id}`}
                  />
                ) : (
                  <span className="text-xs font-mono tracking-wide truncate max-w-[120px]">
                    {env.name}
                  </span>
                )}

                {environments.length > 1 && (
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded hover:bg-[#262626]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(env.id);
                    }}
                    data-testid={`button-remove-env-${env.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 shrink-0 ml-1"
            onClick={onCreate}
            data-testid="button-create-env"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
