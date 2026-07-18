"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Package,
  Settings,
  Store,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/api-status", label: "API Status", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  shopName?: string | null;
}

export function Sidebar({ shopName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-60 flex-col border-r bg-card">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
          <Store className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Etsy Tracker</span>
          {shopName && (
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              {shopName}
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="p-4 text-xs text-muted-foreground">
        <p>v0.1.0</p>
        <p className="mt-1">Single-user Etsy dashboard</p>
      </div>
    </div>
  );
}
