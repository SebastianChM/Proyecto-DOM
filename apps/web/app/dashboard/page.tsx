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
    <Card className="glass-card relative overflow-hidden group">
      <div
        className={`absolute -top-6 -right-6 p-4 opacity-[0.03] group-hover:opacity-10 transition-all duration-500 rotate-12 group-hover:rotate-0 ${color}`}
      >
        <Icon className="w-32 h-32" />
      </div>
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
          {title}
        </CardTitle>
        <div
          className={`p-2.5 rounded-xl bg-white/5 backdrop-blur-md shadow-inner ${color.replace("text-", "text-")} group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-4xl font-black text-foreground mb-2 tracking-tight group-hover:text-glow transition-all">
          {value}
        </div>
        <p className="text-[11px] font-medium text-muted-foreground flex items-center uppercase tracking-wide">
          <span className="text-emerald-400 flex items-center mr-2 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
            <ArrowUpRight className="w-3 h-3 mr-1" /> {trend}
          </span>
          vs last month
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/10">
        <div className="space-y-2">
          <h2 className="text-5xl font-black text-foreground tracking-tight animate-in slide-in-from-left-2 duration-500">
            Welcome back,{" "}
            <span className="text-primary">
              {user?.name?.split(" ")[0] || "User"}
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl animate-in slide-in-from-left-3 duration-700 delay-100">
            Here&apos;s your project overview for today. System performance is
            optimal.
          </p>
        </div>
        <div className="flex gap-3 animate-in slide-in-from-right-2 duration-500">
          <Link href="/dashboard/projects">
            <Button
              variant="outline"
              className="glass-button h-12 px-6 text-base"
            >
              <FolderKanban className="mr-2 h-5 w-5" /> View Projects
            </Button>
          </Link>
          <Link href="/dashboard/projects">
            <Button className="h-12 px-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-105">
              <Plus className="mr-2 h-5 w-5" /> New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Activity
            </h3>
            <Link
              href="/dashboard/projects"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {statsLoading ? (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="glass-panel h-24 animate-pulse rounded-2xl"
                ></div>
              ))
            ) : stats.recentActivity.length === 0 ? (
              <div className="glass-panel p-12 text-center text-muted-foreground rounded-2xl border-dashed">
                <FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No recent activity found.</p>
              </div>
            ) : (
              stats.recentActivity.map((project: any, index: number) => (
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  key={project.id}
                  className="block group"
                >
                  <div className="glass-card p-5 rounded-2xl flex items-center justify-between group-hover:border-primary/30 transition-all duration-300">
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform duration-300 shadow-inner">
                        <FolderKanban className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                          {project.name}
                        </h4>
                        <div className="flex flex-col gap-1 mt-1">
                          <p className="text-xs text-muted-foreground flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Updated{" "}
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </p>
                          {project.location && (
                            <p className="text-[10px] text-muted-foreground/80 flex items-center uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse"></span>
                              {project.location.split(",")[0]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                          Files
                        </div>
                        <div className="font-mono text-lg font-bold text-foreground">
                          {project._count?.files || 0}
                        </div>
                      </div>
                      <div className="p-3 rounded-full bg-white/5 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-white" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-foreground">System Health</h3>
          <Card className="glass-panel border-border">
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
                  className="w-full h-2 rounded-full overflow-hidden appearance-none border-none bg-secondary mb-1 [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-dom-blue [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-dom-blue [&::-moz-progress-bar]:rounded-full"
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
