"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Inbox, Mail, PackageSearch, Search, Send } from "lucide-react";

import { EmptyState, Feedback, PageContainer, PageHeader, PaginationBar, SectionCard, SectionToolbar } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

type Category = "all" | "review" | "availability" | "outgoing";

type Notification = {
  id: number;
  title: string;
  body: string;
  notification_type: string;
  product_id: number | null;
  product_title: string | null;
  product_status: string | null;
  seller_username: string | null;
  seller_email: string | null;
  seller_name: string | null;
  sender_username: string | null;
  sender_email: string | null;
  sender_name: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationList = {
  next: string | null;
  previous: string | null;
  results: Notification[];
};

type NotificationSummary = {
  unread_total: number;
  all: number;
  review: number;
  availability: number;
  outgoing: number;
  unread_review: number;
  unread_availability: number;
  unread_outgoing: number;
};

const emptySummary: NotificationSummary = {
  unread_total: 0,
  all: 0,
  review: 0,
  availability: 0,
  outgoing: 0,
  unread_review: 0,
  unread_availability: 0,
  unread_outgoing: 0,
};

const TYPE_KEYS = new Set([
  "product_submitted_for_review",
  "product_change_requested",
  "product_availability_reminder",
  "product_deactivation_requested",
  "product_withdrawn_from_review",
  "product_approved",
  "product_rejected",
  "product_confirmation",
  "product_deactivated",
  "image_processing_completed",
  "image_processing_failed",
  "message_received",
  "manager_message",
]);

const REVIEW_TYPES = new Set(["product_submitted_for_review", "product_change_requested"]);
const AVAILABILITY_TYPES = new Set([
  "product_confirmation",
  "product_availability_reminder",
  "product_deactivation_requested",
]);

function isUnavailableConfirmation(message: Notification) {
  return /not available/i.test(message.title) || /is not available/i.test(message.body);
}

function personLine(name: string | null, username: string | null, email: string | null) {
  const parts = [name, username ? `@${username}` : null, email].filter(Boolean);
  return parts.join(" · ");
}

function sellerLine(message: Notification) {
  return personLine(message.seller_name, message.seller_username, message.seller_email);
}

function managerLine(message: Notification) {
  return personLine(message.sender_name, message.sender_username, message.sender_email);
}

function productLabel(message: Notification) {
  return message.product_title?.trim() || (message.product_id ? `#${message.product_id}` : "");
}

function highlightProduct(text: string, product: string): ReactNode {
  const needle = product.trim();
  if (!needle || !text.includes(needle)) return text;
  const parts = text.split(needle);
  return parts.map((part, index) => (
    <Fragment key={`${index}-${part.slice(0, 12)}`}>
      {part}
      {index < parts.length - 1 ? (
        <strong className="font-extrabold text-[#142f55]">{needle}</strong>
      ) : null}
    </Fragment>
  ));
}

export default function MessagesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Notification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>(emptySummary);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [previous, setPrevious] = useState(false);
  const [category, setCategory] = useState<Category>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const tabs = useMemo(
    () =>
      [
        {
          id: "all" as const,
          label: t("messages.tabAll"),
          count: unreadOnly ? summary.unread_total : summary.all,
          icon: Inbox,
        },
        {
          id: "review" as const,
          label: t("messages.tabReview"),
          count: unreadOnly ? summary.unread_review : summary.review,
          icon: ClipboardCheck,
        },
        {
          id: "availability" as const,
          label: t("messages.tabAvailability"),
          count: unreadOnly ? summary.unread_availability : summary.availability,
          icon: PackageSearch,
        },
        {
          id: "outgoing" as const,
          label: t("messages.tabOutgoing"),
          count: unreadOnly ? summary.unread_outgoing : summary.outgoing,
          icon: Send,
        },
      ] as const,
    [summary, t, unreadOnly],
  );

  useEffect(() => {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return void window.location.replace("/manager/login");

    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page) });
      if (category !== "all") params.set("category", category);
      if (unreadOnly) params.set("is_read", "false");
      if (appliedSearch) params.set("search", appliedSearch);

      try {
        const [listResponse, summaryResponse] = await Promise.all([
          authorizedFetch(`/api/v1/notifications/?${params}`),
          authorizedFetch("/api/v1/notifications/summary/"),
        ]);
        if (listResponse.status === 401 || summaryResponse.status === 401) {
          return void window.location.replace("/manager/login");
        }
        if (!listResponse.ok) throw new Error();
        const data = (await listResponse.json()) as NotificationList;
        setMessages(data.results);
        setNext(Boolean(data.next));
        setPrevious(Boolean(data.previous));
        if (summaryResponse.ok) {
          setSummary((await summaryResponse.json()) as NotificationSummary);
        }
      } catch {
        setError(t("messages.loadError"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [page, category, unreadOnly, appliedSearch, t]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function selectCategory(nextCategory: Category) {
    setPage(1);
    setCategory(nextCategory);
  }

  async function openMessage(message: Notification) {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return;
    const isOutgoing = category === "outgoing";
    if (!isOutgoing && !message.is_read) {
      const response = await authorizedFetch(`/api/v1/notifications/${message.id}/read/`, { method: "POST" });
      if (response.ok) {
        setMessages((items) => items.map((item) => (item.id === message.id ? { ...item, is_read: true } : item)));
        setSummary((current) => ({
          ...current,
          unread_total: Math.max(0, current.unread_total - 1),
          unread_review: REVIEW_TYPES.has(message.notification_type)
            ? Math.max(0, current.unread_review - 1)
            : current.unread_review,
          unread_availability: AVAILABILITY_TYPES.has(message.notification_type)
            ? Math.max(0, current.unread_availability - 1)
            : current.unread_availability,
        }));
      }
    }
    if (message.product_id) router.push(`/manager/products/${message.product_id}`);
  }

  async function readAll() {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return;
    const response = await authorizedFetch("/api/v1/notifications/read-all/", { method: "POST" });
    if (!response.ok) return;
    setMessages((items) => items.map((item) => ({ ...item, is_read: true })));
    setSummary((current) => ({
      ...current,
      unread_total: 0,
      unread_review: 0,
      unread_availability: 0,
    }));
  }

  function typeLabel(type: string) {
    if (!TYPE_KEYS.has(type)) return type.replaceAll("_", " ");
    return t(`messages.type.${type}` as MessageKey);
  }

  function reviewBadge(status: string | null | undefined) {
    if (status === "approved") {
      return {
        badge: t("messages.badge.reviewedApproved"),
        badgeClass: "bg-[var(--ui-success-bg)] text-[var(--ui-success)]",
      };
    }
    if (status === "rejected") {
      return {
        badge: t("messages.badge.reviewedRejected"),
        badgeClass: "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]",
      };
    }
    if (status === "withdrawn") {
      return {
        badge: t("messages.badge.withdrawn"),
        badgeClass: "bg-secondary text-muted-foreground",
      };
    }
    return {
      badge: t("messages.type.product_submitted_for_review"),
      badgeClass: "bg-[var(--ui-warn-bg)] text-[var(--ui-warn)]",
    };
  }

  function messagePresentation(message: Notification) {
    const seller = message.seller_name || message.seller_username || t("messages.sellerFallback");
    const product = productLabel(message) || t("messages.productFallback");

    if (message.notification_type === "product_confirmation") {
      if (isUnavailableConfirmation(message)) {
        return {
          badge: t("messages.badge.unavailable"),
          badgeClass: "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]",
          title: t("messages.copy.unavailableTitle"),
          body: t("messages.copy.unavailableBody", { seller, product }),
        };
      }
      return {
        badge: t("messages.badge.available"),
        badgeClass: "bg-[var(--ui-success-bg)] text-[var(--ui-success)]",
        title: t("messages.copy.availableTitle"),
        body: t("messages.copy.availableBody", { seller, product }),
      };
    }

    if (REVIEW_TYPES.has(message.notification_type)) {
      const reviewed = reviewBadge(message.product_status);
      const templates: Record<string, { title: MessageKey; body: MessageKey }> = {
        product_submitted_for_review: {
          title: "messages.copy.submittedTitle",
          body: "messages.copy.submittedBody",
        },
        product_change_requested: {
          title: "messages.copy.changeTitle",
          body: "messages.copy.changeBody",
        },
      };
      const template = templates[message.notification_type];
      return {
        ...reviewed,
        badge:
          message.notification_type === "product_change_requested" &&
          message.product_status !== "approved" &&
          message.product_status !== "rejected" &&
          message.product_status !== "withdrawn"
            ? typeLabel(message.notification_type)
            : reviewed.badge,
        badgeClass:
          message.notification_type === "product_change_requested" &&
          message.product_status !== "approved" &&
          message.product_status !== "rejected" &&
          message.product_status !== "withdrawn"
            ? "bg-[var(--ui-warn-bg)] text-[var(--ui-warn)]"
            : reviewed.badgeClass,
        title: t(template.title),
        body: t(template.body, { seller, product }),
      };
    }

    const templates: Partial<Record<string, { title: MessageKey; body: MessageKey }>> = {
      product_availability_reminder: {
        title: "messages.copy.reminderTitle",
        body: "messages.copy.reminderBody",
      },
      product_deactivation_requested: {
        title: "messages.copy.deactivationTitle",
        body: "messages.copy.deactivationBody",
      },
      product_withdrawn_from_review: {
        title: "messages.copy.withdrawnTitle",
        body: "messages.copy.withdrawnBody",
      },
    };

    const template = templates[message.notification_type];
    if (template) {
      return {
        badge: typeLabel(message.notification_type),
        badgeClass: badgeTone(message.notification_type),
        title: t(template.title),
        body: t(template.body, { seller, product }),
      };
    }

    return {
      badge: typeLabel(message.notification_type),
      badgeClass: badgeTone(message.notification_type),
      title: message.title || typeLabel(message.notification_type),
      body: message.body || t("messages.noDetails"),
    };
  }

  function badgeTone(type: string) {
    if (REVIEW_TYPES.has(type)) return "bg-[var(--ui-warn-bg)] text-[var(--ui-warn)]";
    if (type === "product_availability_reminder" || type === "product_deactivation_requested") {
      return "bg-[var(--ui-orange-soft)] text-[#c56a12]";
    }
    if (type === "product_approved" || type === "image_processing_completed") {
      return "bg-[var(--ui-success-bg)] text-[var(--ui-success)]";
    }
    if (type === "product_rejected" || type === "image_processing_failed" || type === "product_deactivated") {
      return "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]";
    }
    return "bg-secondary text-muted-foreground";
  }

  const unreadHint =
    category === "outgoing"
      ? summary.unread_outgoing
      : category === "review"
        ? summary.unread_review
        : category === "availability"
          ? summary.unread_availability
          : summary.unread_total;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("common.panel")}
        title={t("messages.title")}
        description={t("messages.subtitle")}
        primaryAction={
          category === "outgoing" ? null : (
            <Button variant="secondary" disabled={!summary.unread_total} onClick={() => void readAll()}>
              {t("messages.markAll")}
            </Button>
          )
        }
      />

      <SectionCard>
        <SectionToolbar className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" onSubmit={applySearch}>
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("messages.searchPlaceholder")}
                aria-label={t("messages.searchLabel")}
              />
            </div>
            <Button type="submit">{t("common.search")}</Button>
          </form>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-primary">
            <Checkbox
              checked={unreadOnly}
              onCheckedChange={(value) => {
                setPage(1);
                setUnreadOnly(value === true);
              }}
            />
            <span>
              {category === "outgoing" ? t("messages.unreadBySeller") : t("messages.unreadOnly")}
              {unreadHint > 0 ? (
                <span className="ml-1.5 tabular-nums text-[var(--brand-accent)]">({unreadHint})</span>
              ) : null}
            </span>
          </label>
        </SectionToolbar>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-3 sm:px-4">
          {tabs.map((tab) => {
            const active = category === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectCategory(tab.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-bold transition-colors",
                  active
                    ? "border-[var(--brand-accent)] text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {tab.label}
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums",
                    active ? "bg-[var(--ui-orange-soft)] text-[var(--brand-accent)]" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? <p className="px-5 py-6 text-sm font-semibold text-muted-foreground">{t("messages.loading")}</p> : null}
        {error ? <Feedback className="px-5 py-4">{error}</Feedback> : null}
        {!loading && !error && messages.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={unreadOnly ? t("messages.emptyUnread") : appliedSearch ? t("messages.emptySearch") : t("messages.empty")}
          />
        ) : null}

        {!loading && !error && messages.length > 0 ? (
          <>
            <PaginationBar
              page={page}
              hasPrevious={previous}
              hasNext={next}
              loading={loading}
              onPrevious={() => setPage((value) => value - 1)}
              onNext={() => setPage((value) => value + 1)}
              previousLabel={t("common.previousShort")}
              nextLabel={t("common.nextShort")}
              pageLabel={t("common.page", { page })}
            />
            <div className="divide-y divide-border">
              {messages.map((message) => {
                const seller = sellerLine(message);
                const manager = managerLine(message);
                const product = productLabel(message);
                const presentation = messagePresentation(message);
                const outgoingUnread = category === "outgoing" && !message.is_read;
                return (
                  <article
                    key={message.id}
                    className={cn(
                      "flex items-start gap-4 px-5 py-4 transition-colors",
                      message.is_read ? "bg-card" : "bg-[rgba(247,148,29,0.04)]",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                      onClick={() => void openMessage(message)}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2.5 shrink-0 rounded-full",
                          message.is_read ? "bg-border" : "bg-[var(--brand-accent)]",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 space-y-1.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-extrabold", presentation.badgeClass)}>
                            {presentation.badge}
                          </span>
                          {category === "outgoing" ? (
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[11px] font-extrabold",
                                message.is_read
                                  ? "bg-[var(--ui-success-bg)] text-[var(--ui-success)]"
                                  : "bg-[var(--ui-warn-bg)] text-[var(--ui-warn)]",
                              )}
                            >
                              {message.is_read ? t("messages.sellerRead") : t("messages.sellerUnread")}
                            </span>
                          ) : null}
                          {!message.is_read && category !== "outgoing" ? (
                            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--brand-accent)]">
                              {t("messages.newBadge")}
                            </span>
                          ) : null}
                          {outgoingUnread ? (
                            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--brand-accent)]">
                              {t("messages.awaitingSeller")}
                            </span>
                          ) : null}
                        </span>
                        <strong className="block text-sm font-extrabold text-primary">{presentation.title}</strong>
                        <small className="block text-sm text-muted-foreground">
                          {highlightProduct(presentation.body, product)}
                        </small>
                        {manager ? (
                          <span className="block text-xs font-semibold text-muted-foreground">
                            <span className="font-extrabold text-primary">{t("messages.managerLabel")}</span>{" "}
                            {manager}
                          </span>
                        ) : null}
                        {seller ? (
                          <span className="block text-xs font-semibold text-muted-foreground">
                            <span className="font-extrabold text-primary">{t("messages.sellerLabel")}</span>{" "}
                            {seller}
                          </span>
                        ) : null}
                        {message.product_id ? (
                          <em className="block text-xs font-bold not-italic text-[var(--brand-accent)]">
                            #{message.product_id}
                            {message.product_title ? (
                              <>
                                {" · "}
                                <strong className="font-extrabold text-[#142f55]">{message.product_title}</strong>
                              </>
                            ) : null}
                          </em>
                        ) : null}
                      </span>
                    </button>
                    <time className="shrink-0 text-xs font-semibold text-muted-foreground" dateTime={message.created_at}>
                      {formatDate(message.created_at, true)}
                    </time>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </SectionCard>
    </PageContainer>
  );
}
