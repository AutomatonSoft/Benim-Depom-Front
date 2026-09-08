"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar, MobileHeader } from "@/components/Sidebar";
import { LocaleProvider } from "@/i18n";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "@/app/manager-ui.css";

export default function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/manager/login") {
    return (
      <LocaleProvider>
        <TooltipProvider>
          {children}
          <Toaster theme="light" position="top-right" richColors closeButton />
        </TooltipProvider>
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider>
      <TooltipProvider>
        <div className="app-shell flex min-h-dvh bg-background">
          <AppSidebar />
          <div className="app-main flex min-w-0 flex-1 flex-col overflow-x-hidden">
            <MobileHeader />
            {children}
          </div>
        </div>
        <Toaster theme="light" position="top-right" richColors closeButton />
      </TooltipProvider>
    </LocaleProvider>
  );
}
