"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { UserMenu } from "@/components/UserMenu";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  files: "Files",
  bom: "BOM",
  compliance: "Compliance",
  results: "Results",
  rules: "Rules",
  settings: "Settings",
  viewer: "Viewer",
  compare: "Compare",
  validation: "Validation",
  sys: "System",
  acl: "Access Control",
};

function getLabel(segment: string): string {
  return routeLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function TopBar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumb items from path segments (skip "dashboard" as root → "Home")
  const crumbs = segments.map((seg, i) => ({
    label: i === 0 ? "Home" : getLabel(seg),
    isLast: i === segments.length - 1,
  }));

  return (
    <header className="h-12 min-h-[48px] bg-card border-b border-border flex items-center px-4 gap-2.5 shrink-0">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-xs">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/50 text-[10px]">/</span>}
            <span
              className={
                crumb.isLast
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground/70 transition-colors"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Search trigger */}
      <button className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-muted border border-border rounded-md text-muted-foreground text-xs cursor-pointer hover:border-border/80 hover:bg-accent transition-all min-w-[180px]">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span>Search everything...</span>
        <kbd className="ml-auto bg-card border border-border px-1 rounded text-[10px] text-muted-foreground leading-4">
          ⌘K
        </kbd>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <ThemeToggle className="h-8 w-8" />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
