"use client";

import { User, Bell, Shield, Palette, Globe, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { userService } from "@/lib/api/services";
import { toast } from "sonner";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, refreshUser } = useUser();
  // Initialise with safe defaults; real values are loaded from localStorage
  // after mount to avoid SSR crashes and hydration mismatches.
  const [projectUpdates, setProjectUpdates] = useState(true);
  const [fileProcessing, setFileProcessing] = useState(true);
  const [glassmorphism, setGlassmorphism] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load localStorage preferences only after the component has mounted on the client
  useEffect(() => {
    if (!mounted) return;
    try {
      setProjectUpdates(
        localStorage.getItem("dom_pref_projectUpdates") !== "false",
      );
      setFileProcessing(
        localStorage.getItem("dom_pref_fileProcessing") !== "false",
      );
      setGlassmorphism(
        localStorage.getItem("dom_pref_glassmorphism") !== "false",
      );
    } catch {
      // localStorage unavailable (e.g. private browsing storage quota)
    }
  }, [mounted]);

  // Initialise displayName from user once available
  useEffect(() => {
    if (user?.name && !displayName) {
      const saved = localStorage.getItem("dom_pref_displayName");
      setDisplayName(saved ?? user.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist display name to the server when it has changed.
      // This ensures the name appears correctly to other users in the platform.
      if (displayName.trim() && displayName.trim() !== user?.name) {
        await userService.updateProfile(displayName.trim());
        // Refresh the user context so the new name is reflected immediately
        await refreshUser();
      }

      // UI preferences are device-specific and stored locally.
      localStorage.setItem("dom_pref_displayName", displayName.trim());
      localStorage.setItem("dom_pref_projectUpdates", String(projectUpdates));
      localStorage.setItem("dom_pref_fileProcessing", String(fileProcessing));
      localStorage.setItem("dom_pref_glassmorphism", String(glassmorphism));

      toast.success("Settings saved", {
        description:
          "Your display name has been updated. UI preferences are saved for this device.",
      });
    } catch {
      toast.error("Failed to save settings", {
        description:
          "Your display name could not be updated. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const isDark = theme === "dark";

  if (!mounted) {
    return null; // or a loading skeleton
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Settings
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your account and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-lg p-6 border-l-4 border-primary relative overflow-hidden shadow-xs">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white/10 mb-4 shadow-sm">
                {user?.name ? (
                  user.name.charAt(0).toUpperCase()
                ) : (
                  <User className="w-10 h-10" />
                )}
              </div>
              <h3 className="text-xl font-bold text-foreground">
                {displayName || user?.name || "—"}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                {user?.role === "ADMIN" ? "Administrator" : "BIM User"}
              </p>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full border border-border">
                <Shield className="w-3 h-3 text-green-400" />
                <span>
                  {user?.role === "ADMIN" ? "Admin Access" : "User Access"}
                </span>
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
          <div className="bg-card border border-border rounded-lg p-6 shadow-xs">
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
          <div className="bg-card border border-border rounded-lg p-6 shadow-xs">
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
          <div className="bg-card border border-border rounded-lg p-6 shadow-xs">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-brand-subtle rounded-lg">
                <User className="w-5 h-5 text-primary" />
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
                  className="bg-card border-border text-foreground focus-visible:ring-primary"
                />
              </div>
              <div className="flex justify-end mt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-brand hover:bg-brand-dark text-white"
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
