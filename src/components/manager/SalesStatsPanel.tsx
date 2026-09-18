"use client";

import Link from "next/link";
import { Barcode, Mail, Package, Receipt, Search, Wallet } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ChannelCard } from "@/components/manager/ChannelCard";
import { DateRangePicker } from "@/components/manager/DateRangePicker";
import { Feedback, MetricCard, SectionCard } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { useI18n, type MessageKey } from "@/i18n";

type ChannelSold = {
  marketplace: string;  
  account: string;
  quantity_sold: number;
  orders_count: number;
};

type SalesStats = {
  scope: "all" | "seller" | "product";
  product_id: number | null;
  product_title: string | null;
  ean: string;
  seller_id: number | null;
  seller_email: string;
  seller_name: string;
  quantity_sold: number;
  orders_count: number;
  amount_eur: string | null;
  amount_try: string | null;
  amount_usd: string | null;
  from: string | null;
  to: string | null;
  by_channel: ChannelSold[];
};

const CHANNEL_ORDER: Array<{ marketplace: string; account: string; label: string }> = [
  { marketplace: "otto", account: "jv", label: "OTTO JV" },
  { marketplace: "kaufland", account: "jv", label: "KAUFLAND JV" },
  { marketplace: "hood", account: "jv", label: "HOOD JV" },
  { marketplace: "otto", account: "xl", label: "OTTO XL" },
  { marketplace: "kaufland", account: "xl", label: "KAUFLAND XL" },
  { marketplace: "hood", account: "xl", label: "HOOD XL" },
];

function berlinTodayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthRange() {
  const to = berlinTodayIso();
  const [year, month] = to.split("-");
  return { from: `${year}-${month}-01`, to };
}

function formatMoney(amount: string | null, currency: string, locale: string) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency || "EUR"}`.trim();
  }
}

export function SalesStatsPanel() {
  const { t, locale } = useI18n();
  const initial = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [eanInput, setEanInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [ean, setEan] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (query: { from: string; to: string; ean: string; sellerEmail: string }) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (query.from) params.set("from", query.from);
      if (query.to) params.set("to", query.to);
      if (query.ean.trim()) params.set("ean", query.ean.trim());
      if (query.sellerEmail.trim()) params.set("seller_email", query.sellerEmail.trim());
      const suffix = params.toString() ? `?${params}` : "";
      try {
        const response = await authorizedFetch(`/api/v1/manager/sales-stats/${suffix}`);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setStats(null);
          setError(apiErrorMessage(data, t("overview.statsError")));
          return;
        }
        setStats(data as SalesStats);
      } catch {
        setStats(null);
        setError(t("overview.statsError"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await load({
        from: initial.from,
        to: initial.to,
        ean: "",
        sellerEmail: "",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [initial.from, initial.to, load]);

  function searchEan(event: FormEvent) {
    event.preventDefault();
    const nextEan = eanInput.trim();
    setEan(nextEan);
    void load({ from, to, ean: nextEan, sellerEmail });
  }

  function searchSeller(event: FormEvent) {
    event.preventDefault();
    const nextEmail = emailInput.trim();
    setSellerEmail(nextEmail);
    void load({ from, to, ean, sellerEmail: nextEmail });
  }

  function resetLookups() {
    setEanInput("");
    setEmailInput("");
    setEan("");
    setSellerEmail("");
    void load({ from, to, ean: "", sellerEmail: "" });
  }

  const scopeKey: MessageKey =
    stats?.scope === "product"
      ? "overview.scopeProduct"
      : stats?.scope === "seller"
        ? "overview.scopeSeller"
        : "overview.scopeAll";

  return (
    <SectionCard>
      <div className="space-y-5 px-5 py-5">
        <DateRangePicker
          from={from}
          to={to}
          onChange={(range) => {
            setFrom(range.from);
            setTo(range.to);
            void load({ from: range.from, to: range.to, ean, sellerEmail });
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <form onSubmit={searchEan} className="min-w-0">
            <Label htmlFor="stats-ean">{t("overview.eanLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="stats-ean"
                value={eanInput}
                onChange={(event) => setEanInput(event.target.value)}
                placeholder={t("overview.eanPlaceholder")}
                inputMode="numeric"
                autoComplete="off"
              />
              <Button type="submit" size="icon" aria-label={t("overview.searchEan")}>
                <Barcode className="size-4" />
              </Button>
            </div>
          </form>
          <form onSubmit={searchSeller} className="min-w-0">
            <Label htmlFor="stats-email">{t("overview.sellerEmailLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="stats-email"
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder={t("overview.sellerEmailPlaceholder")}
                autoComplete="off"
              />
              <Button type="submit" size="icon" aria-label={t("overview.searchSeller")}>
                <Search className="size-4" />
              </Button>
            </div>
          </form>
        </div>

        {(ean || sellerEmail) && (
          <div className="flex flex-wrap items-center gap-2">
            {ean ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">
                <Barcode className="size-3.5" />
                {ean}
              </span>
            ) : null}
            {sellerEmail ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">
                <Mail className="size-3.5" />
                {sellerEmail}
              </span>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={resetLookups}>
              {t("overview.resetFilters")}
            </Button>
          </div>
        )}

        {error ? <Feedback>{error}</Feedback> : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : stats ? (
          <>
            <p className="text-sm font-semibold text-muted-foreground">
              {t(scopeKey, {
                name: stats.seller_name || stats.seller_email || t("overview.sellerFallback"),
                title: stats.product_title || stats.ean || "—",
              })}
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                tone="navy"
                icon={Receipt}
                label={t("overview.ordersCount")}
                value={stats.orders_count ?? 0}
                hint={t("overview.ordersHint")}
              />
              <MetricCard
                icon={Package}
                label={t("overview.quantitySold")}
                value={stats.quantity_sold}
                hint={t("overview.unitsHint")}
              />
              <MetricCard
                tone="accent"
                icon={Wallet}
                label={t("overview.salesAmount")}
                value={formatMoney(stats.amount_eur, "EUR", locale)}
                hint={`${formatMoney(stats.amount_try, "TRY", locale)} · ${formatMoney(stats.amount_usd, "USD", locale)}`}
              />
            </div>
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                {t("overview.soldByChannel")}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {CHANNEL_ORDER.map((channel) => {
                  const item = stats.by_channel?.find(
                    (row) => row.marketplace === channel.marketplace && row.account === channel.account,
                  );
                  const sold = item?.quantity_sold ?? 0;
                  const orders = item?.orders_count ?? 0;
                  return (
                    <ChannelCard
                      key={`${channel.marketplace}-${channel.account}`}
                      label={channel.label}
                      value={sold}
                      active={sold > 0}
                      hint={`${t("overview.quantitySold")} · ${t("overview.ordersCountShort", { count: orders })}`}
                    />
                  );
                })}
              </div>
            </div>
            {stats.scope === "product" && stats.product_id ? (
              <Button asChild variant="link" className="px-0">
                <Link href={`/manager/products/${stats.product_id}`}>{t("overview.openProduct")}</Link>
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}
