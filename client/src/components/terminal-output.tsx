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
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground select-none">
            <div className="text-3xl opacity-30">&#9654;</div>
            <span className="text-xs tracking-wider uppercase opacity-50">
              Initialize runtime to begin
            </span>
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
              <span className="text-muted-foreground mr-2 select-none">▸</span>
            )}
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
