"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Building2,
  FolderKanban,
  FileText,
  TableProperties,
  Box,
  FileCheck,
  Shield,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import apiClient from "@/lib/axios-config";
import { useUser } from "@/context/UserContext";
import { logger } from "@/lib/logger";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Main",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: FolderKanban, label: "Projects", href: "/dashboard/projects" },
      { icon: FileText, label: "All Files", href: "/dashboard/files" },
    ],
  },
  {
    title: "Analysis",
    items: [
      {
        icon: TableProperties,
        label: "BOM & Quantities",
        href: "/dashboard/bom",
      },
      { icon: Box, label: "3D Viewer", href: "/dashboard/viewer" },
    ],
  },
  {
    title: "Compliance",
    items: [
      { icon: FileCheck, label: "Validation", href: "/dashboard/validation" },
      {
        icon: ClipboardCheck,
        label: "Regulation Packs",
        href: "/dashboard/packs",
      },
    ],
  },
  {
    title: "System",
    items: [{ icon: Settings, label: "Settings", href: "/dashboard/settings" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading } = useUser();

  // Inject admin item into System group
  const groups =
    user?.role === "ADMIN"
      ? navGroups.map((g) =>
          g.title === "System"
            ? {
                ...g,
                items: [
                  ...g.items,
                  {
                    icon: Shield,
                    label: "Admin Panel",
                    href: "/dashboard/sys/acl",
                  },
                ],
              }
            : g,
        )
      : navGroups;

  const handleLogout = async () => {
    if (!user) {
      window.location.href = "/api/auth/login";
      return;
    }
    try {
      await apiClient.post("/api/auth/logout");
      window.location.href = "/";
    } catch (error) {
      logger.warn("Logout failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      window.location.href = "/";
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

  return (
    <aside className="w-64 h-screen sticky top-0 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 z-30">
      {/* Logo — compact */}
      <div className="h-12 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="bg-brand text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="leading-none">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">
              DOM
            </span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] ml-1.5">
              BIM
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation — grouped */}
      <nav className="flex-1 py-3 px-2.5 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title} className="mb-3">
            <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                        isActive
                          ? "bg-brand-subtle text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {/* Left active indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-primary" />
                      )}
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer — minimal */}
      <div className="p-2.5 border-t border-sidebar-border">
        <div
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors group"
        >
          {user?.picture ? (
            <Image
              src={user.picture}
              alt={user.name}
              width={28}
              height={28}
              className="w-7 h-7 rounded-full"
              unoptimized
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-violet flex items-center justify-center text-[10px] font-bold text-white">
              {user ? getInitials(user.name) : ".."}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-sidebar-foreground truncate">
              {loading ? "Loading..." : user ? user.name : "Guest"}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {user ? "Sign out" : "Sign in"}
            </div>
          </div>
          <LogOut className="w-3.5 h-3.5 text-muted-foreground group-hover:text-danger shrink-0" />
        </div>
      </div>
    </aside>
  );
}
