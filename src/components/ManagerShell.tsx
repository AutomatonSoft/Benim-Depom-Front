"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import { LocaleProvider } from "@/i18n";

export default function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/manager/login") {
    return <LocaleProvider>{children}</LocaleProvider>;
  }

  return (
    <LocaleProvider>
      <div className="app-shell">
        <Sidebar />
        {children}
      </div>
    </LocaleProvider>
  );
}
