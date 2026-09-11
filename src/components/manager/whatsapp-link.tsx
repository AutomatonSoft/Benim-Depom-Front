"use client";

import type { ReactNode } from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { whatsappChatUrl } from "@/lib/whatsapp";

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.85 14.18c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.26-4.79-4.19-4.94-4.39-.14-.19-1.18-1.57-1.18-3 0-1.42.74-2.12 1-2.41.24-.27.53-.34.71-.34h.51c.16 0 .38-.06.59.45.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.27.48-.14.16-.29.36-.41.49-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.24.09 1.54.73 1.8.86.27.14.44.2.51.31.07.11.07.64-.17 1.32z"
      />
    </svg>
  );
}

export function WhatsAppLink({
  phone,
  children,
  className,
  iconClassName,
}: {
  phone?: string | null;
  children?: ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  const { t } = useI18n();
  const href = whatsappChatUrl(phone);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("common.whatsappChat")}
      title={t("common.whatsappChat")}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-[#25D366] transition-colors hover:bg-[#25D366]/12 hover:text-[#128C7E]",
        children ? "h-auto max-w-full gap-1 px-0.5 py-0.5" : "size-7",
        className,
      )}
    >
      {children}
      <WhatsAppGlyph className={cn("size-4 shrink-0", iconClassName)} />
    </a>
  );
}
