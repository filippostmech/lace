import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ["Ctrl", "Enter"], description: "Run current code" },
  { keys: ["Ctrl", "S"], description: "Save workspace snapshot" },
  { keys: ["Ctrl", "N"], description: "Create new file" },
  { keys: ["?"], description: "Toggle this help panel" },
];

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="shortcuts-overlay"
    >
      <div
        className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-foreground tracking-wide">
            Keyboard Shortcuts
          </h2>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="w-6 h-6"
            data-testid="button-close-shortcuts"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">
                {s.description}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {s.keys.map((key, j) => (
                  <span key={j}>
                    <kbd className="px-2 py-0.5 rounded-sm bg-[#262626] border border-[#333] text-[11px] font-mono text-foreground">
                      {key}
                    </kbd>
                    {j < s.keys.length - 1 && (
                      <span className="text-muted-foreground text-[10px] mx-0.5">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-[#262626]">
          <p className="text-[10px] text-muted-foreground text-center tracking-wider">
            Press <kbd className="px-1 py-0.5 rounded-sm bg-[#262626] border border-[#333] text-[10px] font-mono">?</kbd> to toggle
          </p>
        </div>
      </div>
    </div>
  );
}
