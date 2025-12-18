"use client";

import { User, Bell, Shield, Palette, Globe, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useUser();
  const [projectUpdates, setProjectUpdates] = useState(true);
  const [fileProcessing, setFileProcessing] = useState(true);
  const [glassmorphism, setGlassmorphism] = useState(true);
  const [displayName, setDisplayName] = useState("Sebastian C.");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    toast.success("Settings saved successfully", {
      description: "Your preferences have been updated.",
    });
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const isDark = theme === "dark";

  if (!mounted) {
    return null; // or a loading skeleton
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-foreground">
            Settings
          </h2>
          <p className="mt-2 text-lg text-muted-foreground">
            Manage your account and preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel border-border rounded-2xl p-6 border-l-4 border-dom-blue relative overflow-hidden shadow-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-dom-blue/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-dom-blue to-purple-500 flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white/10 mb-4 shadow-xl">
                SC
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Sebastian C.
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Architect & BIM Manager
              </p>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full border border-border">
                <Shield className="w-3 h-3 text-green-400" />
                <span>Admin Access</span>
              </div>
            </div>

            <div className="border-t border-border my-6"></div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center">
                  <Mail className="w-4 h-4 mr-2" /> Email
                </span>
                <span className="text-foreground font-medium">
                  {user?.email || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center">
                  <Globe className="w-4 h-4 mr-2" /> Location
                </span>
                <span className="text-foreground font-medium">
                  Santiago, Chile
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appearance */}
          <div className="glass-panel border-border rounded-2xl p-6 shadow-md">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Palette className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Appearance</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground font-medium">
                    Dark Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable dark aesthetic for the interface
                  </p>
                </div>
                <Switch
                  checked={isDark}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                />
              </div>
              <div className="border-t border-border my-4"></div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground font-medium">
                    Glassmorphism Effects
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable blur and transparency effects
                  </p>
                </div>
                <Switch
                  checked={glassmorphism}
                  onCheckedChange={setGlassmorphism}
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="glass-panel border-border rounded-2xl p-6 shadow-md">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Bell className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Notifications
              </h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground font-medium">
                    Project Updates
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications when projects are modified
                  </p>
                </div>
                <Switch
                  checked={projectUpdates}
                  onCheckedChange={setProjectUpdates}
                />
              </div>
              <div className="border-t border-border my-4"></div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground font-medium">
                    File Processing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notify when file processing is complete
                  </p>
                </div>
                <Switch
                  checked={fileProcessing}
                  onCheckedChange={setFileProcessing}
                />
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="glass-panel border-border rounded-2xl p-6 shadow-md">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-dom-blue/10 rounded-lg">
                <User className="w-5 h-5 text-dom-blue" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Account</h3>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label
                  htmlFor="username"
                  className="text-muted-foreground font-medium"
                >
                  Display Name
                </Label>
                <Input
                  id="username"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-card border-border text-foreground focus-visible:ring-dom-blue"
                />
              </div>
              <div className="flex justify-end mt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-dom-blue hover:bg-dom-blue-dark text-white"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
