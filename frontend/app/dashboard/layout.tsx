"use client"

import { Sidebar } from "@/components/Sidebar"
import { UserProvider } from "@/context/UserContext"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <UserProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-transparent text-gray-900 dark:text-white flex">
                <Sidebar />
                <main className="flex-1 ml-64 p-8 relative">
                    {/* Background Ambient Glow */}
                    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] overflow-hidden">
                        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-dom-blue/10 dark:bg-dom-blue/20 rounded-full blur-[120px] opacity-50 dark:opacity-50 animate-pulse-blue"></div>
                        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-500/10 dark:bg-purple-900/20 rounded-full blur-[100px] opacity-30"></div>
                    </div>

                    <div className="max-w-7xl mx-auto animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </UserProvider>
    )
}
