"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, MoreHorizontal, Package, Trash2, Users } from "lucide-react";

import { ConfirmDialog } from "@/components/manager/confirm-dialog";
import { EmptyState, Feedback, PageContainer, PageHeader, PaginationBar, SectionCard, SectionToolbar } from "@/components/manager/ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { authorizedFetch, apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n } from "@/i18n";

type Seller = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_joined: string;
  product_count?: number;
  is_active?: boolean;
  is_email_verified?: boolean;
};

type SellerListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Seller[];
};

type SellerFilter = "" | "active" | "pending";

function fullName(seller: Seller) {
  return `${seller.first_name} ${seller.last_name}`.trim() || seller.username;
}

function isPendingEmail(seller: Seller) {
  return seller.is_email_verified === false;
}

export default function SellersPage() {
  const { t } = useI18n();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [activity, setActivity] = useState<SellerFilter>("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingSeller, setPendingSeller] = useState<Seller | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const access = window.localStorage.getItem("benim_access_token");
    if (!access) {
      window.location.replace("/manager/login");
      return;
    }

    const params = new URLSearchParams({ page: String(page) });
    if (activity === "active") params.set("is_active", "true");
    if (activity === "pending") params.set("is_email_verified", "false");
    if (appliedSearch) params.set("search", appliedSearch);

    async function loadSellers() {
      setLoading(true);
      setError("");

      try {
        const response = await authorizedFetch(`/api/v1/manager/users/sellers/?${params}`);

        if (response.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/manager/login");
          return;
        }

        if (!response.ok) throw new Error("request failed");

        const data = (await response.json()) as SellerListResponse;
        setSellers(data.results);
        setCount(data.count);
        setHasNext(Boolean(data.next));
        setHasPrevious(Boolean(data.previous));
      } catch {
        setError(t("sellers.loadError"));
      } finally {
        setLoading(false);
      }
    }

    void loadSellers();
  }, [page, activity, appliedSearch, reloadKey, t]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  async function confirmEmail(seller: Seller) {
    if (confirmingId !== null) return;
    setConfirmingId(seller.id);
    setActionError("");
    setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/manager/users/sellers/${seller.id}/confirm-email/`, {
        method: "POST",
      });
      if (response.status === 401) return void window.location.replace("/manager/login");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t("sellers.confirmEmailFailed")));
      }
      const updated = data as Seller;
      setSellers((items) => items.map((item) => (item.id === seller.id ? { ...item, ...updated } : item)));
      setFeedback(t("sellers.confirmEmailDone", { name: fullName(seller) }));
      if (activity === "pending") setReloadKey((value) => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : t("sellers.confirmEmailFailed"));
    } finally {
      setConfirmingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingSeller || deleting) return;
    setDeleting(true);
    setActionError("");
    setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/manager/users/sellers/${pendingSeller.id}/`, { method: "DELETE" });
      if (response.status === 401) return void window.location.replace("/manager/login");
      if (response.status === 204) {
        setSellers((items) => items.filter((item) => item.id !== pendingSeller.id));
        setCount((value) => Math.max(0, value - 1));
        setFeedback(t("sellers.deleted", { name: fullName(pendingSeller) }));
        setPendingSeller(null);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (response.status === 202) {
        setFeedback(typeof data.detail === "string" ? data.detail : t("sellers.blocked"));
        setPendingSeller(null);
        return;
      }
      throw new Error(apiErrorMessage(data, t("sellers.deleteFailed")));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : t("sellers.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("common.panel")}
        title={t("sellers.title")}
        description={t("sellers.subtitle", { count })}
        primaryAction={
          <Button asChild variant="accent">
            <Link href="/manager/managers/new">{t("sellers.createManager")}</Link>
          </Button>
        }
      />

      <SectionCard>
        <SectionToolbar>
          <form className="flex w-full flex-wrap items-center gap-3" onSubmit={applySearch}>
            <Input
              className="min-w-[220px] flex-1"
              aria-label={t("sellers.searchAria")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("sellers.searchPlaceholder")}
            />
            <FilterSelect
              className="w-[200px]"
              aria-label={t("sellers.filterAria")}
              value={activity}
              onChange={(event) => {
                setPage(1);
                setActivity(event.target.value as SellerFilter);
              }}
            >
              <option value="">{t("sellers.all")}</option>
              <option value="active">{t("common.active")}</option>
              <option value="pending">{t("sellers.pendingEmail")}</option>
            </FilterSelect>
            <Button type="submit">{t("common.search")}</Button>
          </form>
        </SectionToolbar>

        {loading ? <p className="px-5 py-6 text-sm font-semibold text-muted-foreground">{t("sellers.loading")}</p> : null}
        {error ? <Feedback className="px-5 py-4">{error}</Feedback> : null}
        {actionError && !loading ? <Feedback className="px-5 py-2">{actionError}</Feedback> : null}
        {feedback && !error && !actionError ? <Feedback tone="success" className="px-5 py-2">{feedback}</Feedback> : null}
        {!loading && !error && sellers.length === 0 ? <EmptyState icon={Users} title={t("sellers.empty")} /> : null}

        {!loading && !error && sellers.length > 0 ? (
          <>
            <PaginationBar
              page={page}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              loading={loading}
              onPrevious={() => setPage((value) => value - 1)}
              onNext={() => setPage((value) => value + 1)}
              previousLabel={t("common.previous")}
              nextLabel={t("common.next")}
              pageLabel={t("common.page", { page })}
            />
            <div className="overflow-x-auto">
            <div className="grid min-w-[920px] grid-cols-[minmax(220px,1.4fr)_minmax(200px,1fr)_100px_140px_56px] gap-3 border-b border-border bg-[#f8fafc] px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">
              <span>{t("sellers.col.seller")}</span>
              <span>{t("sellers.col.contact")}</span>
              <span className="text-right">{t("sellers.col.products")}</span>
              <span>{t("sellers.col.joined")}</span>
              <span />
            </div>
            {sellers.map((seller) => {
              const pending = isPendingEmail(seller);
              return (
              <article
                key={seller.id}
                className="grid min-w-[920px] grid-cols-[minmax(220px,1.4fr)_minmax(200px,1fr)_100px_140px_56px] items-center gap-3 border-b border-border px-5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary text-xs font-extrabold text-primary-foreground">
                      {fullName(seller).slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-extrabold text-primary">{fullName(seller)}</h2>
                      {pending ? (
                        <span className="rounded-md bg-[var(--ui-warning-bg,rgba(247,148,29,0.14))] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--brand-accent,#f7941d)]">
                          {t("sellers.pendingEmailBadge")}
                        </span>
                      ) : null}
                    </div>
                    <small className="text-xs font-semibold text-muted-foreground">@{seller.username}</small>
                  </div>
                </div>
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-semibold text-primary">{seller.email || t("sellers.noEmail")}</strong>
                  <small className="text-xs text-muted-foreground">{seller.phone || t("sellers.noPhone")}</small>
                </div>
                <Link
                  className="text-right text-sm font-extrabold text-primary hover:text-[var(--brand-accent)]"
                  href={`/manager/sellers/${seller.id}/products`}
                  aria-label={t("sellers.openProducts", { name: fullName(seller) })}
                >
                  {seller.product_count ?? 0}
                </Link>
                <time className="text-xs font-semibold text-muted-foreground" dateTime={seller.date_joined}>
                  {formatDate(seller.date_joined)}
                </time>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={t("sellers.actionsAria", { name: fullName(seller) })}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/manager/sellers/${seller.id}/products`}>
                        <Package />
                        {t("sellers.openProducts", { name: fullName(seller) })}
                      </Link>
                    </DropdownMenuItem>
                    {pending ? (
                      <DropdownMenuItem
                        disabled={confirmingId === seller.id}
                        onClick={() => void confirmEmail(seller)}
                      >
                        <BadgeCheck />
                        {confirmingId === seller.id ? t("sellers.confirmEmailWorking") : t("sellers.confirmEmail")}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setActionError("");
                        setFeedback("");
                        setPendingSeller(seller);
                      }}
                    >
                      <Trash2 />
                      {t("sellers.deleteTitle")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </article>
            );
            })}
          </div>
          </>
        ) : null}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(pendingSeller)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingSeller(null);
        }}
        title={t("sellers.deleteTitle")}
        description={
          pendingSeller ? (
            <>
              <p>{t("sellers.deleteWarning")}</p>
              <p>{t("sellers.productCount", { count: pendingSeller.product_count ?? 0 })}</p>
              <p>{t("sellers.confirm")}</p>
              {actionError ? <Feedback>{actionError}</Feedback> : null}
            </>
          ) : null
        }
        cancelLabel={t("sellers.no")}
        confirmLabel={deleting ? t("sellers.deleting") : t("sellers.yes")}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </PageContainer>
  );
}
