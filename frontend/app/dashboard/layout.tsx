"use client"

import { Sidebar } from "@/components/Sidebar"
import { UserProvider } from "@/context/UserContext"
import { NotificationProvider } from "@/context/NotificationContext"
import { NotificationBell } from "@/components/NotificationBell"
import { UserMenu } from "@/components/UserMenu"

function DashboardContent({ children }: { children: React.ReactNode }) {
    return (
        <NotificationProvider>
            <div className="min-h-screen bg-background dark:bg-transparent text-foreground dark:text-white flex">
                <Sidebar />
                <main className="flex-1 ml-64 p-8 relative">
                    {/* Background Ambient Glow - Premium & Dynamic */}
                    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] overflow-hidden">
                        {/* Primary Blue Glow (Top Right) */}
                        <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-10 dark:opacity-40 animate-pulse-blue mix-blend-screen"></div>

                        {/* Secondary Purple Glow (Bottom Left) */}
                        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] opacity-10 dark:opacity-30 animate-float mix-blend-screen"></div>

                        {/* Accent Cyan Glow (Center) */}
                        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[80px] opacity-0 dark:opacity-20 animate-pulse delay-1000 mix-blend-screen"></div>
                    </div>

                    {/* Global Notification Bell & User Menu - Fixed Position */}
                    <div className="fixed top-6 right-8 z-[99] flex items-center gap-4">
                        <NotificationBell />
                        <UserMenu />
                    </div>

                    <div className="max-w-7xl mx-auto animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </NotificationProvider>
    )
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <UserProvider>
            <DashboardContent>
                {children}
            </DashboardContent>
        </UserProvider>
    )
}
