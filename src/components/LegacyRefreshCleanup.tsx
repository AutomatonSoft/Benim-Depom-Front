"use client";

import { useEffect } from "react";

import { clearLegacyRefreshToken } from "@/lib/api";

export default function LegacyRefreshCleanup() {
  useEffect(() => {
    clearLegacyRefreshToken();
  }, []);

  return null;
}
