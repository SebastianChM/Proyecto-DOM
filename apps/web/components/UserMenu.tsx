"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/context/UserContext";
import { LogOut, User as UserIcon } from "lucide-react";
import apiClient from "@/lib/axios-config";
import { useRouter } from "next/navigation";

export function UserMenu() {
  const { user } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Save user info for "Welcome Back" screen
      if (user) {
        localStorage.setItem(
          "dom_last_user",
          JSON.stringify({
            name: user.name,
            email: user.email,
            picture: user.picture,
          }),
        );
      }
      await apiClient.post("/api/auth/logout");
      window.location.href = "/"; // Full reload to clear client state
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-colors cursor-pointer ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
          <AvatarImage src={user.picture} alt={user.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {user.name?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 glass-panel border-white/10"
      >
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={() => router.push("/dashboard/profile")}
          className="cursor-pointer focus:bg-primary/10 focus:text-primary"
        >
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
