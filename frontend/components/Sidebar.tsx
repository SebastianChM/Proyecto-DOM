"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Settings, LogOut, Building2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useUser } from "@/context/UserContext"

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
]

export function Sidebar() {
    const pathname = usePathname()
    const { user } = useUser()
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    const handleLogout = async () => {
        try {
            // Call backend logout endpoint
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
            });
            // Redirect to login page
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
            // Force redirect even if API fails
            window.location.href = '/';
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2)
    }

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 bg-gradient-to-b from-dom-blue via-dom-blue-dark to-dom-black dark:from-[#0a0e27] dark:via-[#0f1419] dark:to-black border-r border-dom-blue/30 dark:border-[#2a2f4a] flex flex-col z-50 shadow-2xl shadow-dom-blue/20">
            {/* Logo Area */}
            <div className="h-20 flex items-center px-6 border-b border-white/10 dark:border-[#2a2f4a] bg-white/5 dark:bg-white/5">
                <div className="flex items-center space-x-3">
                    <div className="bg-white dark:bg-dom-blue w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-white/20 ring-2 ring-white/30 dark:ring-dom-blue/50">
                        <Building2 className="w-6 h-6 text-dom-blue dark:text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">DOM</h1>
                        <p className="text-[10px] text-blue-200 dark:text-gray-400 uppercase tracking-widest font-medium">BIM Platform</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-8 px-4 space-y-2">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link key={item.href} href={item.href}>
                            <div
                                className={cn(
                                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group cursor-pointer",
                                    isActive
                                        ? "bg-white dark:bg-dom-blue text-dom-blue dark:text-white shadow-lg shadow-white/20 dark:shadow-dom-blue/30 scale-105"
                                        : "text-blue-100 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5 hover:text-white hover:scale-102"
                                )}
                            >
                                <div className="flex items-center space-x-3">
                                    <item.icon className={cn("w-5 h-5", isActive ? "text-dom-blue dark:text-white" : "text-blue-200 dark:text-gray-400 group-hover:text-white")} />
                                    <span className="font-medium">{item.label}</span>
                                </div>
                                {isActive && <ChevronRight className="w-4 h-4 text-dom-blue dark:text-white" />}
                            </div>
                        </Link>
                    )
                })}
            </nav>

            {/* User Profile / Logout */}
            <div className="p-4 border-t border-white/10 dark:border-[#2a2f4a] bg-black/20 dark:bg-black/40">
                <div
                    onClick={handleLogout}
                    className="bg-white/10 dark:bg-white/5 backdrop-blur-sm p-3 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-red-500/20 hover:border-red-500/50 border border-white/10 dark:border-[#2a2f4a] transition-all duration-300"
                >
                    <div className="flex items-center space-x-3">
                        {user?.picture ? (
                            <Image 
                                src={user.picture} 
                                alt={user.name} 
                                width={32} 
                                height={32} 
                                className="w-8 h-8 rounded-full ring-2 ring-white/30" 
                                unoptimized
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white to-blue-200 dark:from-dom-blue dark:to-purple-500 flex items-center justify-center text-xs font-bold text-dom-blue dark:text-white ring-2 ring-white/30">
                                {user ? getInitials(user.name) : '...'}
                            </div>
                        )}
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-white group-hover:text-red-200 transition-colors truncate max-w-[100px]">
                                {user ? user.name : 'Loading...'}
                            </span>
                            <span className="text-[10px] text-blue-200 dark:text-gray-400 group-hover:text-red-300 transition-colors">Log Out</span>
                        </div>
                    </div>
                    <LogOut className="w-4 h-4 text-blue-200 dark:text-gray-400 group-hover:text-red-400 transition-colors" />
                </div>
            </div>
        </aside>
    )
}
