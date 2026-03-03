import { useEffect, useRef } from "react";
import type { TerminalLine } from "@/hooks/use-pyodide";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TerminalOutputProps {
  lines: TerminalLine[];
}

export function TerminalOutput({ lines }: TerminalOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 font-mono text-sm leading-relaxed min-h-full" data-testid="terminal-output">
        {lines.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 text-muted-foreground select-none">
            <div className="relative">
              <div className="w-12 h-12 rounded-lg border border-[#262626] flex items-center justify-center">
                <span className="text-xl opacity-20">&gt;_</span>
              </div>
            </div>
            <div className="text-center space-y-1.5">
              <span className="text-xs tracking-wider uppercase opacity-40 block">
                Terminal output
              </span>
              <span className="text-[10px] opacity-30 block">
                Initialize the runtime, then run your code
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 mt-2">
              <div className="flex items-center gap-2 text-[10px] opacity-25">
                <kbd className="px-1.5 py-0.5 rounded-sm bg-[#1a1a1a] border border-[#262626] font-mono">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 rounded-sm bg-[#1a1a1a] border border-[#262626] font-mono">Enter</kbd>
                <span className="ml-1">to run</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] opacity-25">
                <kbd className="px-1.5 py-0.5 rounded-sm bg-[#1a1a1a] border border-[#262626] font-mono">?</kbd>
                <span className="ml-1">for all shortcuts</span>
              </div>
            </div>
          </div>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            data-testid={`terminal-line-${line.id}`}
            className={`whitespace-pre-wrap break-all ${
              line.type === "stderr"
                ? "text-red-400"
                : line.type === "system"
                  ? "text-[hsl(253.5,100%,75%)] opacity-80"
                  : "text-[#E9E9E9]"
            }`}
          >
            {line.type === "system" && (
              <span className="text-muted-foreground mr-2 select-none">&#9656;</span>
            )}
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
