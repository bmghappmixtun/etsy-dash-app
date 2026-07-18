"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

interface TopbarProps {
  shopName?: string | null;
  title?: string;
}

export function Topbar({ shopName, title }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <Sidebar shopName={shopName} />
          </SheetContent>
        </Sheet>

        {title && (
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
