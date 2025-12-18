"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Building2, User, ArrowRight } from "lucide-react"

interface LastUser {
  name: string
  email: string
  picture?: string
}

export default function LoginPage() {
  const [lastUser, setLastUser] = useState<LastUser | null>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('dom_last_user')
    if (storedUser) {
      try {
        setLastUser(JSON.parse(storedUser))
      } catch (e) {
        console.error("Failed to parse last user", e)
      }
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dom-blue-dark via-[#0d0d40] to-black p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>

      {/* Animated Blue Accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-dom-blue-light to-transparent animate-pulse-blue"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center z-10">
        {/* Hero Section */}
        <div className="text-white space-y-8 animate-slide-up">
          <div className="space-y-6">
            {/* DOM Logo */}
            <div className="flex items-center space-x-4">
              <div className="bg-dom-blue w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl shadow-dom-blue/40 ring-1 ring-white/10">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-bold tracking-tight text-white">DOM</h1>
                <p className="text-dom-blue-light text-sm font-medium tracking-wider uppercase">BIM Platform</p>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold leading-tight text-balance">
              Engineering the <br />
              <span className="text-dom-blue-light">Future</span>
            </h2>

            <p className="text-gray-300 text-lg leading-relaxed max-w-md">
              Advanced BIM project management, automated validation, and seamless collaboration for enterprise architecture.
            </p>
          </div>

          {/* Cleaned up Features - purely informational now */}
          <div className="flex gap-6 pt-4">
            <div className="flex flex-col gap-2 stagger-1 animate-fade-in">
              <span className="text-2xl font-bold text-white">75+</span>
              <span className="text-xs text-gray-400 uppercase tracking-wider">Years of<br />Excellence</span>
            </div>
            <div className="w-px bg-white/10 h-12"></div>
            <div className="flex flex-col gap-2 stagger-2 animate-fade-in">
              <span className="text-2xl font-bold text-white">Global</span>
              <span className="text-xs text-gray-400 uppercase tracking-wider">Presence<br />& Impact</span>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card className="w-full shadow-2xl border-white/10 bg-white/95 backdrop-blur-xl stagger-2 animate-fade-in">
          <CardHeader className="text-center space-y-2 pt-8">
            <CardTitle className="text-2xl font-bold text-dom-black">
              {lastUser ? `Welcome back, ${lastUser.name.split(' ')[0]}` : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-base text-gray-500">
              {lastUser ? 'Continue with your previous account or switch' : 'Sign in to access your projects'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            {lastUser ? (
              <div className="space-y-4">
                {/* Last User Profile Card */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarImage src={lastUser.picture} alt={lastUser.name} />
                    <AvatarFallback className="bg-dom-blue/10 text-dom-blue">
                      <User className="w-6 h-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lastUser.name}</p>
                    <p className="text-xs text-gray-500 truncate">{lastUser.email}</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <Button className="w-full h-12 bg-dom-blue hover:bg-dom-blue-dark text-white shadow-md transition-all" asChild>
                    <a href="/api/auth/login" className="flex items-center justify-center gap-2">
                      Continue as {lastUser.name.split(' ')[0]}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  </Button>

                  <Button variant="outline" className="w-full h-12 border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors" asChild>
                    <a href="/api/auth/login?prompt=login">
                      Sign in with different account
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-dom-blue/5 border-l-4 border-dom-blue p-4 rounded-r-md">
                  <p className="font-semibold text-dom-blue-dark text-sm mb-1">Secure Access</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Authenticated via Autodesk Platform Services for enterprise-grade security.
                  </p>
                </div>

                <Button className="w-full h-14 text-base font-semibold bg-dom-blue hover:bg-dom-blue-dark text-white shadow-lg shadow-dom-blue/20 transition-all hover:scale-[1.02]" size="lg" asChild>
                  <a href="/api/auth/login">
                    Sign In with Autodesk
                  </a>
                </Button>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-center border-t border-gray-100 py-6">
            <p className="text-xs text-center text-gray-400">
              © 2024 Sebastian Chirino.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
