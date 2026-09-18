"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { ChannelCard } from "@/components/manager/ChannelCard";
import { SalesStatsPanel } from "@/components/manager/SalesStatsPanel";
import { Feedback, MetricCard, OverviewSectionBanner, PageContainer, PageHeader } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { authorizedFetch } from "@/lib/api";
import { useI18n, type MessageKey } from "@/i18n";

type ActiveListing = {
  marketplace: string;
  account: string;
  count: number;
};

type Dashboard = {
  awaiting_review: number;
  awaiting_review_today: number;
  published_today: number;
  published_today_marketplaces: number;
  active_sellers: number;
  sellers_joined_this_month: number;
  active_listings: ActiveListing[];
  free_eans: { jv: number; xl: number; total: number };
};

type Profile = {
  username: string;
  first_name: string;
};

type FallbackProduct = {
  id: number;
  title: string;
  product_type: string;
  created_at: string;
  images?: Array<{ image: string; is_primary: boolean }>;
  seller?: { username: string; first_name: string };
};

type ListResponse<T> = {
  count: number;
  results: T[];
};

function greetingName(profile: Profile | null, fallback: string) {
  const name = profile?.first_name.trim() || profile?.username || "";
  return name || fallback;
}

function greetingHello(hour: number, t: (key: MessageKey) => string) {
  if (hour < 12) return t("overview.helloMorning");
  if (hour < 18) return t("overview.helloAfternoon");
  return t("overview.helloEvening");
}

function emptyActiveListings(): ActiveListing[] {
  return [
    { marketplace: "otto", account: "jv", count: 0 },
    { marketplace: "kaufland", account: "jv", count: 0 },
    { marketplace: "hood", account: "jv", count: 0 },
    { marketplace: "otto", account: "xl", count: 0 },
    { marketplace: "kaufland", account: "xl", count: 0 },
    { marketplace: "hood", account: "xl", count: 0 },
  ];
}

function orderedListings(listings: ActiveListing[]): ActiveListing[] {
  return emptyActiveListings().map((channel) => {
    const match = listings.find(
      (listing) => listing.marketplace === channel.marketplace && listing.account === channel.account,
    );
    return match ?? channel;
  });
}

function channelLabel(listing: ActiveListing) {
  const marketplace = listing.marketplace === "otto" ? "OTTO" : listing.marketplace === "hood" ? "Hood" : "Kaufland";
  return `${marketplace} ${listing.account.toUpperCase()}`;
}

function isSameLocalDay(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

async function loadFallbackDashboard(): Promise<Dashboard> {
  const [submittedResponse, sellersResponse] = await Promise.all([
    authorizedFetch("/api/v1/manager/products/?status=submitted&page=1"),
    authorizedFetch("/api/v1/manager/users/sellers/?is_active=true&page=1"),
  ]);

  if (!submittedResponse.ok || !sellersResponse.ok) {
    throw new Error("fallback failed");
  }

  const submitted = (await submittedResponse.json()) as ListResponse<FallbackProduct>;
  const sellers = (await sellersResponse.json()) as ListResponse<{ date_joined?: string }>;

  return {
    awaiting_review: submitted.count,
    awaiting_review_today: submitted.results.filter((product) => isSameLocalDay(product.created_at)).length,
    published_today: 0,
    published_today_marketplaces: 0,
    active_sellers: sellers.count,
    sellers_joined_this_month: sellers.results.filter((seller) => {
      if (!seller.date_joined) return false;
      const joined = new Date(seller.date_joined);
      const now = new Date();
      return joined.getMonth() === now.getMonth() && joined.getFullYear() === now.getFullYear();
    }).length,
    active_listings: emptyActiveListings(),
    free_eans: { jv: 0, xl: 0, total: 0 },
  };
}

export default function Home() {
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!window.localStorage.getItem("benim_access_token")) {
      window.location.replace("/manager/login");
      return;
    }

    async function loadOverview() {
      setLoading(true);
      setError("");
      try {
        const [dashboardResponse, meResponse] = await Promise.all([
          authorizedFetch("/api/v1/manager/dashboard/"),
          authorizedFetch("/api/v1/auth/me/"),
        ]);

        if (dashboardResponse.status === 401 || meResponse.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/manager/login");
          return;
        }

        if (meResponse.ok) setProfile((await meResponse.json()) as Profile);

        if (dashboardResponse.ok) {
          const data = (await dashboardResponse.json()) as Dashboard;
          setDashboard({
            ...data,
            active_listings: orderedListings(
              data.active_listings?.length ? data.active_listings : emptyActiveListings(),
            ),
            free_eans: data.free_eans ?? { jv: 0, xl: 0, total: 0 },
          });
        } else {
          setDashboard(await loadFallbackDashboard());
        }
      } catch {
        setError(t("overview.loadError"));
      } finally {
        setLoading(false);
      }
    }

    void loadOverview();
  }, [t]);

  const hello = greetingHello(new Date().getHours(), t);
  const name = greetingName(profile, t("overview.there"));
  const heading = profile ? (name ? t("overview.helloName", { hello, name }) : hello) : hello;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("common.panel")}
        title={heading}
        secondaryActions={
          <Button asChild variant="outline" size="icon" aria-label={t("nav.messages")}>
            <Link href="/manager/messages">
              <Bell className="size-4" />
            </Link>
          </Button>
        }
      />

      {error ? <Feedback className="mb-4">{error}</Feedback> : null}

      <OverviewSectionBanner
        className="mb-4"
        title={t("overview.catalogSection")}
        description={t("overview.catalogSectionHint")}
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <MetricCard
          label={t("overview.awaitingReview")}
          value={loading ? "—" : dashboard?.awaiting_review ?? 0}
          hint={t("overview.today", { count: dashboard?.awaiting_review_today ?? 0 })}
        />
        <MetricCard
          label={t("overview.publishedToday")}
          value={loading ? "—" : dashboard?.published_today ?? 0}
          hint={
            (dashboard?.published_today_marketplaces ?? 0) === 0
              ? t("overview.noListingsToday")
              : dashboard?.published_today_marketplaces === 1
                ? t("overview.acrossMarketplaces", { count: dashboard?.published_today_marketplaces ?? 0 })
                : t("overview.acrossMarketplacesPlural", { count: dashboard?.published_today_marketplaces ?? 0 })
          }
        />
        <MetricCard
          label={t("overview.activeSellers")}
          value={loading ? "—" : dashboard?.active_sellers ?? 0}
          hint={t("overview.thisMonth", { count: dashboard?.sellers_joined_this_month ?? 0 })}
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {orderedListings(dashboard?.active_listings ?? emptyActiveListings()).map((listing) => (
          <ChannelCard
            key={`${listing.marketplace}-${listing.account}`}
            label={channelLabel(listing)}
            value={loading ? "—" : listing.count}
            active={!loading && listing.count > 0}
            hint={t("overview.activeListings")}
          />
        ))}
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <MetricCard
          tone={(dashboard?.free_eans?.jv ?? 0) < 20 ? "warning" : "default"}
          label={t("overview.freeEanJv")}
          value={loading ? "—" : dashboard?.free_eans?.jv ?? 0}
          hint={t("overview.availableInPool")}
        />
        <MetricCard
          tone={(dashboard?.free_eans?.xl ?? 0) < 20 ? "warning" : "default"}
          label={t("overview.freeEanXl")}
          value={loading ? "—" : dashboard?.free_eans?.xl ?? 0}
          hint={t("overview.availableInPool")}
        />
      </div>

      <OverviewSectionBanner
        className="mb-4"
        title={t("overview.salesSection")}
        description={t("overview.salesSectionHint")}
      />

      <SalesStatsPanel />
    </PageContainer>
  );
}
