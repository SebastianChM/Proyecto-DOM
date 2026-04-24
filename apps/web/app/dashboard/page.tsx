/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { dashboardService } from "@/lib/api/services";
import {
  FolderKanban,
  FileText,
  Box,
  Activity,
  Clock,
  ArrowUpRight,
  CheckCircle,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalFiles: 0,
    activeModels: 0,
    totalSize: 0,
    recentActivity: [] as any[],
    isProcessing: false,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  useEffect(() => {
    // Wait for user authentication check to complete
    if (userLoading) return;

    // If not authenticated, we can't fetch stats
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        const data = await dashboardService.stats();
        setStats(data);
      } catch (error) {
        logger.error("Failed to load dashboard stats", {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        showError(error, user?.role, "Failed to load dashboard stats");
      } finally {
        setStatsLoading(false);
      }
    };
    fetchDashboardData();
  }, [user, userLoading]);

  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-2xl font-bold">Authentication Required</h2>
        <p className="text-muted-foreground">
          Please sign in to view your dashboard.
        </p>
        <Link href="/api/auth/login">
          <Button size="lg" className="gap-2">
            Sign in with Autodesk
          </Button>
        </Link>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
    <Card className="border border-border shadow-xs relative overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-[22px] font-bold text-foreground tracking-tight">
          {value}
        </div>
        <div className="mt-1 flex items-center text-[11px]">
          <span className="text-success-fg bg-success-bg border border-success/20 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-medium">
            <ArrowUpRight className="w-3 h-3" /> {trend}
          </span>
          <span className="text-muted-foreground ml-1.5">vs last month</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Welcome back,{" "}
            <span className="text-primary">
              {user?.name?.split(" ")[0] || "User"}
            </span>
          </h2>
          <p className="text-muted-foreground text-sm">
            Here&apos;s your project overview for today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/projects">
            <Button variant="outline" size="sm">
              <FolderKanban className="mr-1.5 h-4 w-4" /> View Projects
            </Button>
          </Link>
          <Link href="/dashboard/projects">
            <Button size="sm" className="bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-sm shadow-[#6366f1]/20">
              <Plus className="mr-1.5 h-4 w-4" /> New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard
          title="Total Projects"
          value={statsLoading ? "..." : stats.totalProjects}
          icon={FolderKanban}
          trend="+12%"
          color="text-blue-500"
        />
        <StatCard
          title="Total Files"
          value={statsLoading ? "..." : stats.totalFiles}
          icon={FileText}
          trend="+24%"
          color="text-purple-500"
        />
        <StatCard
          title="Active Models"
          value={statsLoading ? "..." : stats.activeModels}
          icon={Box}
          trend="+5%"
          color="text-orange-500"
        />
        <StatCard
          title="System Status"
          value="Operational"
          icon={Activity}
          trend="99.9%"
          color="text-green-500"
        />
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </h3>
            <Link
              href="/dashboard/projects"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {statsLoading ? (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-card border border-border h-16 animate-pulse rounded-lg"
                ></div>
              ))
            ) : stats.recentActivity.length === 0 ? (
              <div className="bg-card border border-border border-dashed p-8 text-center text-muted-foreground rounded-lg">
                <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No recent activity found.</p>
              </div>
            ) : (
              stats.recentActivity.map((project: any) => (
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  key={project.id}
                  className="block group"
                >
                  <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between hover:border-primary/30 hover:bg-brand-subtle/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-subtle rounded-md text-primary">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {project.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(project.updatedAt).toLocaleDateString()}
                          {project.location && (
                            <span className="ml-1.5">· {project.location.split(",")[0]}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                        {project._count?.files || 0} files
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">System Health</h3>
          <Card className="border border-border shadow-xs">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  <span className="text-sm font-medium text-foreground">
                    APS Services
                  </span>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  <span className="text-sm font-medium text-foreground">
                    Database
                  </span>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${stats.isProcessing ? "bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"}`}
                  ></div>
                  <span className="text-sm font-medium text-foreground">
                    Conversion Engine
                  </span>
                </div>
                <span
                  className={`text-xs ${stats.isProcessing ? "text-blue-500 font-semibold" : "text-yellow-500"}`}
                >
                  {stats.isProcessing ? "Processing..." : "Idle"}
                </span>
              </div>
              <div className="pt-4 border-t border-border">
                <progress
                  value={stats.totalSize}
                  max={100 * 1024 * 1024 * 1024}
                  className="w-full h-1.5 rounded-full overflow-hidden appearance-none border-none bg-secondary [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-moz-progress-bar]:rounded-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatBytes(stats.totalSize)} Used</span>
                  <span>100 GB Total</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
// End of DashboardPage
