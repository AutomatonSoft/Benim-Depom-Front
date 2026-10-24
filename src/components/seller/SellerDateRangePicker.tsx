"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { berlinBusinessDate, getSellerDatePreset, parseSellerIsoDate, sellerDateToIso, shiftSellerCalendarMonth, type SellerDatePreset, type SellerDateRange } from "@/lib/seller-date-range";

const presets: Array<[SellerDatePreset, string]> = [
  ["allTime", "All time"],
  ["today", "Today"], ["yesterday", "Yesterday"], ["thisWeek", "This week"], ["lastWeek", "Last week"],
  ["last7Days", "Last 7 days"], ["last30Days", "Last 30 days"], ["thisMonth", "This month"], ["lastMonth", "Last month"],
];

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function calendarCells(month: Date) {
  const first = monthStart(month);
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
}

export default function SellerDateRangePicker({ from, to, onChange }: {
  from: string;
  to: string;
  onChange: (range: SellerDateRange) => void;
}) {
  const { t, locale } = useSellerI18n();
  const today = berlinBusinessDate();
  const [open, setOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState(() => monthStart(from ? parseSellerIsoDate(from) : parseSellerIsoDate(today)));
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const rightMonth = shiftSellerCalendarMonth(leftMonth, 1);
  const dateLocale = ({ en: "en-GB", ru: "ru-RU", tr: "tr-TR", de: "de-DE" } as const)[locale];
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, index + 1));
    return new Intl.DateTimeFormat(dateLocale, { weekday: "short", timeZone: "UTC" }).format(date);
  }), [dateLocale]);
  const formatter = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", year: "numeric" });
  const label = !from && !to ? t("All time") : from && to ? `${formatter.format(parseSellerIsoDate(from))} – ${formatter.format(parseSellerIsoDate(to))}` : t("Select date range");
  const rangeFrom = draftFrom;
  const rangeTo = draftTo || draftFrom;

  function commit(range: SellerDateRange) {
    setDraftFrom(range.from);
    setDraftTo(range.to);
    onChange(range);
    setLeftMonth(monthStart(parseSellerIsoDate(range.from || today)));
    setOpen(false);
  }

  function pickDay(date: Date) {
    const value = sellerDateToIso(date);
    if (!draftFrom || draftTo) {
      setDraftFrom(value);
      setDraftTo("");
      return;
    }
    commit(value < draftFrom ? { from: value, to: draftFrom } : { from: draftFrom, to: value });
  }

  function renderMonth(month: Date) {
    const title = new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric" }).format(month);
    return <section className="seller-calendar-month" aria-label={title} key={`${month.getFullYear()}-${month.getMonth()}`}>
      <h3>{title}</h3>
      <div className="seller-calendar-weekdays">{weekdays.map((weekday, index) => <span key={`${index}-${weekday}`}>{weekday}</span>)}</div>
      <div className="seller-calendar-days">{calendarCells(month).map((date, index) => {
        if (!date) return <span className="seller-calendar-empty" key={`empty-${index}`} aria-hidden="true" />;
        const iso = sellerDateToIso(date);
        const selected = iso === rangeFrom || iso === rangeTo;
        const between = Boolean(rangeFrom && rangeTo && iso > rangeFrom && iso < rangeTo);
        return <button
          type="button"
          key={iso}
          aria-label={formatter.format(date)}
          aria-pressed={selected}
          className={`seller-calendar-day${selected ? " selected" : between ? " between" : ""}${iso === today ? " today" : ""}`}
          onClick={() => pickDay(date)}
        >{date.getDate()}</button>;
      })}</div>
    </section>;
  }

  return <Popover open={open} onOpenChange={next => {
    setOpen(next);
    if (next) {
      setDraftFrom(from);
      setDraftTo(to);
      setLeftMonth(monthStart(from ? parseSellerIsoDate(from) : parseSellerIsoDate(today)));
    }
  }}>
    <PopoverTrigger asChild>
      <button type="button" className="seller-date-range-trigger" aria-label={`${t("Select date range")}: ${label}`} aria-expanded={open}>
        <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown size={17} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={7} collisionPadding={14} className="seller-date-range-popover">
      <div className="seller-date-range-presets" aria-label={t("Date range presets")}>
        {presets.map(([id, title]) => <button type="button" key={id} onClick={() => commit(getSellerDatePreset(id, today))}>{t(title)}</button>)}
      </div>
      <div className="seller-calendar-nav">
        <button type="button" aria-label={t("Previous month")} onClick={() => setLeftMonth(month => shiftSellerCalendarMonth(month, -1))}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" aria-label={t("Next month")} onClick={() => setLeftMonth(month => shiftSellerCalendarMonth(month, 1))}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className="seller-calendar-months">{renderMonth(leftMonth)}{renderMonth(rightMonth)}</div>
      <p className="seller-date-range-hint" aria-live="polite">{draftFrom && !draftTo ? t("Choose an end date") : t("Dates use Europe/Berlin business time.")}</p>
    </PopoverContent>
  </Popover>;
}
