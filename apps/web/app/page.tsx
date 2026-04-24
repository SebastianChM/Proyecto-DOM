"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, User, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { logger } from "@/lib/logger";

interface LastUser {
  name: string;
  email: string;
  picture?: string;
}

export default function LoginPage() {
  const [lastUser, setLastUser] = useState<LastUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("dom_last_user");
    if (storedUser) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLastUser(JSON.parse(storedUser));
      } catch (e) {
        logger.error("Failed to parse last user", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }, []);

  return (
    <div className="flex flex-col">
      {/* Theme toggle — always visible */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle className="h-10 w-10 bg-card/80 backdrop-blur-sm border border-border shadow-sm" />
      </div>

      {/* Hero + Login — full viewport height */}
      <div className="min-h-screen flex">
      {/* Left Hero Panel — indigo gradient */}
      <div className="hidden lg:flex w-[55%] relative items-center justify-center overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#1a1640] to-[#0f172a]">
        {/* Radial glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#6366f1]/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-[#8b5cf6]/15 blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-[#4f46e5]/10 blur-[80px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 max-w-lg px-12 space-y-10">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-[#6366f1] to-[#4f46e5] w-16 h-16 rounded-xl flex items-center justify-center shadow-lg shadow-[#6366f1]/30">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white">DOM</h1>
              <p className="text-xs text-[#818cf8] font-medium tracking-[0.2em] uppercase">BIM Platform</p>
            </div>
          </div>

          <h2 className="text-5xl font-bold leading-tight text-white">
            Engineering the{" "}
            <span className="bg-gradient-to-r from-[#818cf8] to-[#a78bfa] bg-clip-text text-transparent">
              Future
            </span>
          </h2>

          <p className="text-[#b4b4be] text-lg leading-relaxed">
            Advanced BIM project management, automated validation, and seamless collaboration for enterprise architecture.
          </p>

          <div className="flex gap-10 pt-4">
            <div>
              <span className="text-3xl font-bold text-white">75+</span>
              <p className="text-xs text-[#74747e] uppercase tracking-wider mt-1">Years of Excellence</p>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <span className="text-3xl font-bold text-white">Global</span>
              <p className="text-xs text-[#74747e] uppercase tracking-wider mt-1">Presence & Impact</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="flex-1 flex items-center justify-center bg-background relative p-8">
        {/* Subtle background pattern for right panel */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />

        <Card className="relative z-10 w-full max-w-md border border-border shadow-lg">
          <CardHeader className="text-center space-y-2 pt-10 pb-2">
            <div className="mx-auto mb-2 md:hidden">
              <div className="bg-gradient-to-br from-[#6366f1] to-[#4f46e5] w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-[#6366f1]/30">
                <Building2 className="w-7 h-7 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {lastUser ? `Welcome back, ${lastUser.name.split(" ")[0]}` : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {lastUser ? "Continue with your previous account" : "Sign in to access your projects"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-8 pb-10">
            {lastUser ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                  <Avatar className="h-12 w-12 border border-border">
                    <AvatarImage src={lastUser.picture} alt={lastUser.name} />
                    <AvatarFallback className="bg-brand-subtle text-primary">
                      <User className="w-6 h-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground truncate">{lastUser.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{lastUser.email}</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <Button
                    className="w-full h-12 text-base bg-gradient-to-r from-[#6366f1] to-[#4f46e5] hover:from-[#4f46e5] hover:to-[#4338ca] text-white shadow-sm shadow-[#6366f1]/20 font-semibold"
                    asChild
                  >
                    <a href="/api/auth/login" className="flex items-center justify-center gap-2">
                      Continue as {lastUser.name.split(" ")[0]}
                      <ArrowRight className="w-5 h-5" />
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full h-12 text-base" asChild>
                    <a href="/api/auth/login?prompt=login">Sign in with different account</a>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-brand-subtle border-l-3 border-primary p-4 rounded-r-md">
                  <p className="font-semibold text-primary text-sm mb-1">Secure Access</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Authenticated via Autodesk Platform Services for enterprise-grade security.
                  </p>
                </div>

                <Button
                  className="w-full h-14 text-base font-semibold bg-gradient-to-r from-[#6366f1] to-[#4f46e5] hover:from-[#4f46e5] hover:to-[#4338ca] text-white shadow-lg shadow-[#6366f1]/25"
                  size="lg"
                  asChild
                >
                  <a href="/api/auth/login">Sign In with Autodesk</a>
                </Button>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-center pt-6">
            <p className="text-[11px] text-muted-foreground">
              Secured by Autodesk Platform Services
            </p>
          </CardFooter>
        </Card>
      </div>
      </div>

      {/* Footer — only visible on scroll (content above is min-h-screen) */}
      <Footer />
    </div>
  );
}
