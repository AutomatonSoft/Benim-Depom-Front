import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Benim Depom | Manager",
  description: "Benim Depom manager panel",
};

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return children;
}
