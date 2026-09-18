"use client";

import { Calendar, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

export type DateRangeValue = { from: string; to: string };

const WEEKDAY_KEYS: MessageKey[] = [
  "overview.weekdayMon",
  "overview.weekdayTue",
  "overview.weekdayWed",
  "overview.weekdayThu",
  "overview.weekdayFri",
  "overview.weekdaySat",
  "overview.weekdaySun",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function berlinToday() {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parseIso(stamp);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeekMonday(date: Date) {
  const copy = new Date(date);
  const weekday = copy.getDay();
  copy.setDate(copy.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return copy;
}

function endOfWeekSunday(date: Date) {
  const start = startOfWeekMonday(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

function monthCells(month: Date) {
  const first = startOfMonth(month);
  const startWeekday = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function inRange(iso: string, from: string, to: string) {
  if (!from || !to) return false;
  return iso >= from && iso <= to;
}

type PresetId = "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "all";

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: DateRangeValue, preset: PresetId | "custom") => void;
}) {
  const { t, locale } = useI18n();
  const today = berlinToday();
  const [open, setOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(from ? parseIso(from) : today));
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const rightMonth = addMonths(leftMonth, 1);

  const presets = useMemo(() => {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const weekStart = startOfWeekMonday(today);
    const lastWeekEnd = new Date(weekStart);
    lastWeekEnd.setDate(weekStart.getDate() - 1);
    const lastWeekStart = startOfWeekMonday(lastWeekEnd);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    return [
      { id: "today" as const, label: t("overview.presetToday"), range: { from: toIso(today), to: toIso(today) } },
      { id: "week" as const, label: t("overview.presetWeek"), range: { from: toIso(weekStart), to: toIso(today) } },
      { id: "month" as const, label: t("overview.presetMonth"), range: { from: toIso(monthStart), to: toIso(today) } },
      { id: "yesterday" as const, label: t("overview.presetYesterday"), range: { from: toIso(yesterday), to: toIso(yesterday) } },
      { id: "lastWeek" as const, label: t("overview.presetLastWeek"), range: { from: toIso(lastWeekStart), to: toIso(endOfWeekSunday(lastWeekEnd)) } },
      { id: "lastMonth" as const, label: t("overview.presetLastMonth"), range: { from: toIso(lastMonthStart), to: toIso(lastMonthEnd) } },
    ];
  }, [t, today]);

  function commit(nextFrom: string, nextTo: string, preset: PresetId | "custom") {
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    onChange({ from: nextFrom, to: nextTo }, preset);
  }

  function applyPreset(preset: (typeof presets)[number]) {
    commit(preset.range.from, preset.range.to, preset.id);
    setLeftMonth(startOfMonth(parseIso(preset.range.from)));
    setOpen(false);
  }

  function pickDay(date: Date) {
    const iso = toIso(date);
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(iso);
      setDraftTo("");
      return;
    }
    if (iso < draftFrom) {
      commit(iso, draftFrom, "custom");
      setOpen(false);
      return;
    }
    commit(draftFrom, iso, "custom");
    setOpen(false);
  }

  const formatter = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const monthTitle = (month: Date) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      month: "long",
      year: "numeric",
    }).format(month);

  const label =
    from && to
      ? `${formatter.format(parseIso(from))} - ${formatter.format(parseIso(to))}`
      : t("overview.presetAll");

  const rangeStart = draftFrom;
  const rangeEnd = draftTo || draftFrom;

  function renderMonth(month: Date) {
    return (
      <div className="min-w-[240px]">
        <p className="mb-3 text-center text-sm font-extrabold capitalize text-primary">{monthTitle(month)}</p>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_KEYS.map((key) => (
            <span key={key} className="text-center text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {t(key)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthCells(month).map((cell, index) => {
            if (!cell) return <span key={`empty-${month.getMonth()}-${index}`} />;
            const iso = toIso(cell);
            const selectedStart = iso === rangeStart;
            const selectedEnd = iso === rangeEnd;
            const selected = selectedStart || selectedEnd;
            const between = rangeStart && rangeEnd && inRange(iso, rangeStart, rangeEnd) && !selected;
            const isToday = iso === toIso(today);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => pickDay(cell)}
                className={cn(
                  "grid size-9 place-items-center rounded-full text-sm font-semibold transition-colors",
                  between && "bg-[#eef3f9] text-primary",
                  selected && "bg-primary text-primary-foreground",
                  !selected && !between && "text-primary hover:bg-[#eef3f9]",
                  isToday && !selected && "ring-1 ring-[var(--brand-accent)]",
                )}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setDraftFrom(from);
            setDraftTo(to);
            setLeftMonth(startOfMonth(from ? parseIso(from) : today));
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-primary shadow-[0_1px_2px_rgba(20,47,85,0.06)] hover:border-primary/25"
          >
            <Calendar className="size-4 text-[var(--brand-accent)]" />
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-4 shadow-[0_16px_40px_rgba(20,47,85,0.14)]"
        >
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
              onClick={() => setLeftMonth(addMonths(leftMonth, -1))}
              aria-label={t("overview.prevMonth")}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
              onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
              aria-label={t("overview.nextMonth")}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-6 md:flex-row">
            {renderMonth(leftMonth)}
            {renderMonth(rightMonth)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-border bg-[#f7f9fc] px-3 py-2 text-xs font-bold text-primary hover:border-[var(--brand-accent)] hover:bg-[var(--ui-orange-soft)]"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <span className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-muted-foreground">
        <Globe className="size-4 text-[var(--brand-accent)]" />
        {t("overview.timezoneBerlin")}
      </span>
    </div>
  );
}
