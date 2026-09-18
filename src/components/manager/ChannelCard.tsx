"use client";

import { cn } from "@/lib/utils";

export function ChannelCard({
  label,
  value,
  hint,
  active = false,
}: {
  label: string;
  value: string | number;
  hint: string;
  active?: boolean;
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-[0_8px_24px_rgba(20,47,85,0.06)]",
        active
          ? "border-[rgba(247,148,29,0.35)] from-white to-[#fff8ef]"
          : "border-[#d9e3ef] from-white to-[#f4f7fb]",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#f9a338] to-[#1b3f70]" />
      <div className="pl-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <span className={cn("size-2.5 rounded-full", active ? "bg-[var(--ui-success)]" : "bg-[#d5deea]")} />
        </div>
        <strong className="text-[1.7rem] font-extrabold tabular-nums leading-none text-primary">{value}</strong>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">{hint}</p>
      </div>
    </article>
  );
}
