"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import Sidebar from "@/components/Sidebar";

export default function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/manager/login") {
    return children;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      {children}
    </div>
  );
}
