"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Building2,
  ChevronRight,
  FolderKanban,
  FileText,
  TableProperties,
  Box,
  FileCheck,
  Shield,
  ClipboardCheck,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import apiClient from "@/lib/axios-config";
import { useUser } from "@/context/UserContext";

const baseSidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: FolderKanban, label: "Projects", href: "/dashboard/projects" },
  { icon: FileText, label: "All Files", href: "/dashboard/files" },
  { icon: TableProperties, label: "BOM & Quantities", href: "/dashboard/bom" },
  { icon: Box, label: "3D Viewer", href: "/dashboard/viewer" },
  {
    icon: FileCheck,
    label: "Structure Validation",
    href: "/dashboard/validation",
  },
  {
    icon: ClipboardCheck,
    label: "Reglas Compliance",
    href: "/dashboard/compliance/rules",
  },
  {
    icon: ListChecks,
    label: "Resultados",
    href: "/dashboard/compliance/results",
  },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading } = useUser();

  // Add admin panel for admins only
  const sidebarItems =
    user?.role === "ADMIN"
      ? [
          ...baseSidebarItems,
          { icon: Shield, label: "Admin Panel", href: "/dashboard/sys/acl" },
        ]
      : baseSidebarItems;

  const handleLogout = async () => {
    if (!user) {
      // If guest, redirect to login
      window.location.href = "/api/auth/login";
      return;
    }

    try {
      // Call backend logout endpoint
      await apiClient.post("/api/auth/logout");
      // Redirect to login page
      window.location.href = "/";
    } catch (error) {
      console.warn("Logout failed:", error);
      // Force redirect even if API fails
      window.location.href = "/";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-card border-r border-border flex flex-col z-50 transition-all duration-300 shadow-sm">
      {/* Logo Area */}
      <div className="h-24 flex items-center px-6 border-b border-border bg-background/50 backdrop-blur-sm">
        <div
          className="flex items-center space-x-4 group cursor-pointer"
          onClick={() => (window.location.href = "/dashboard")}
        >
          <div className="bg-dom-blue text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-dom-blue/20 group-hover:scale-110 transition-transform duration-300">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              DOM
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium">
              BIM Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 group cursor-pointer relative overflow-hidden",
                  isActive
                    ? "bg-dom-blue text-white shadow-md shadow-dom-blue/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <div className="flex items-center space-x-3 z-10">
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-colors duration-200",
                      isActive
                        ? "text-white"
                        : "text-muted-foreground group-hover:text-dom-blue",
                    )}
                  />
                  <span className="font-medium tracking-wide text-sm">
                    {item.label}
                  </span>
                </div>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-white/50 animate-in slide-in-from-left-2" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Profile / Logout */}
      <div className="p-4 border-t border-border bg-background/50">
        <div
          onClick={handleLogout}
          className="glass-card p-3 rounded-xl flex items-center justify-between group cursor-pointer hover:border-red-500/30 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-all duration-300"
        >
          <div className="flex items-center space-x-3">
            {user?.picture ? (
              <Image
                src={user.picture}
                alt={user.name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full ring-2 ring-border group-hover:ring-red-500/30 transition-all"
                unoptimized
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-dom-blue to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-md">
                {user ? getInitials(user.name) : "..."}
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold text-foreground group-hover:text-red-600 transition-colors truncate max-w-[120px]">
                {loading ? "Loading..." : user ? user.name : "Guest User"}
              </span>
              <span className="text-[10px] text-muted-foreground group-hover:text-red-500/70 transition-colors uppercase tracking-wider">
                {user ? "Click to Log Out" : "Sign In"}
              </span>
            </div>
          </div>
          <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-red-500 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </aside>
  );
}
