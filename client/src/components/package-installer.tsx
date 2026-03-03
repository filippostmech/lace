import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { RuntimeStatus, InstalledPackage } from "@/hooks/use-pyodide";

interface PackageInstallerProps {
  status: RuntimeStatus;
  installedPackages: InstalledPackage[];
  installingPackage: string | null;
  onInstall: (name: string) => void;
  onRefresh: () => void;
}

const POPULAR_PACKAGES = [
  "numpy",
  "pandas",
  "matplotlib",
  "scipy",
  "scikit-learn",
  "sympy",
  "networkx",
  "pillow",
];

export function PackageInstaller({
  status,
  installedPackages,
  installingPackage,
  onInstall,
  onRefresh,
}: PackageInstallerProps) {
  const [inputValue, setInputValue] = useState("");
  const [expanded, setExpanded] = useState(false);

  const isReady = status === "ready";
  const isInstalling = !!installingPackage;

  const handleInstall = () => {
    const name = inputValue.trim().toLowerCase();
    if (name && !isInstalling) {
      onInstall(name);
      setInputValue("");
    }
  };

  const installedNames = new Set(
    installedPackages.map((p) => p.name.toLowerCase())
  );

  return (
    <div className="flex flex-col border-t border-[#262626]" data-testid="package-installer">
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && isReady) onRefresh();
        }}
        className="flex items-center gap-2 px-3 py-2 w-full text-left transition-colors"
        data-testid="button-toggle-packages"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
        <Package className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-mono text-muted-foreground tracking-wide uppercase">
          Packages
        </span>
        {installingPackage && (
          <Loader2 className="w-3 h-3 text-[hsl(253.5,100%,75%)] animate-spin ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="px-2 pb-2">
          <div className="flex items-center gap-1 mb-2">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInstall();
              }}
              placeholder="package name"
              disabled={!isReady || isInstalling}
              className="flex-1 bg-[#1a1a1a] text-xs font-mono text-foreground rounded-sm px-2 py-1.5 outline-none border border-[#262626] focus:border-[hsl(88,50.4%,52.5%)] transition-colors min-w-0 placeholder:text-muted-foreground/40"
              data-testid="input-package-name"
            />
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 shrink-0"
              onClick={handleInstall}
              disabled={!isReady || isInstalling || !inputValue.trim()}
              data-testid="button-install-package"
            >
              {isInstalling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          <div className="mb-2">
            <span className="text-[10px] text-muted-foreground tracking-wider uppercase px-1 mb-1 block">
              Popular
            </span>
            <div className="flex flex-wrap gap-1">
              {POPULAR_PACKAGES.map((pkg) => {
                const installed = installedNames.has(pkg);
                return (
                  <Badge
                    key={pkg}
                    variant={installed ? "default" : "outline"}
                    className={`text-[10px] font-mono cursor-pointer select-none ${
                      installed
                        ? "opacity-50 cursor-default"
                        : "border-[#262626] text-muted-foreground"
                    }`}
                    onClick={() => {
                      if (!installed && isReady && !isInstalling) {
                        onInstall(pkg);
                      }
                    }}
                    data-testid={`badge-package-${pkg}`}
                  >
                    {pkg}
                  </Badge>
                );
              })}
            </div>
          </div>

          {installedPackages.length > 0 && (
            <div>
              <span className="text-[10px] text-muted-foreground tracking-wider uppercase px-1 mb-1 block">
                Installed ({installedPackages.length})
              </span>
              <ScrollArea className="max-h-[120px]">
                <div className="space-y-0.5">
                  {installedPackages.slice(0, 20).map((pkg) => (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between px-1.5 py-0.5"
                      data-testid={`installed-pkg-${pkg.name}`}
                    >
                      <span className="text-[10px] font-mono text-foreground truncate">
                        {pkg.name}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground ml-2 shrink-0">
                        {pkg.version}
                      </span>
                    </div>
                  ))}
                  {installedPackages.length > 20 && (
                    <span className="text-[9px] text-muted-foreground px-1.5">
                      +{installedPackages.length - 20} more
                    </span>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
