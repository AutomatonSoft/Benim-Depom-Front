"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Handshake, Inbox, Mail, PackageSearch, Search, Send, ShoppingBag } from "lucide-react";

import { EmptyState, Feedback, PageContainer, PageHeader, PaginationBar, SectionCard, SectionToolbar } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { authorizedFetch, apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

type Category = "all" | "review" | "availability" | "price" | "afterbuy" | "outgoing";

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
  seller_comment?: string | null;
  price_accepted?: boolean | null;
  price_negotiation_status?: "pending" | "accepted" | "rejected" | "superseded" | null;
  responded_at?: string | null;
  sender_id: number | null;
  sender_username: string | null;
  sender_email: string | null;
  sender_name: string | null;
  manager_username?: string | null;
  manager_email?: string | null;
  manager_name?: string | null;
  is_read: boolean;
  created_at: string;
  afterbuy_marketplace?: string | null;
  afterbuy_account?: string | null;
  afterbuy_qty_sold?: number | null;
  afterbuy_stock_synced?: boolean;
  afterbuy_seller_notified?: boolean;
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
  price: number;
  outgoing: number;
  unread_review: number;
  unread_availability: number;
  unread_price: number;
  afterbuy: number;
  unread_afterbuy: number;
  unread_outgoing: number;
};

const emptySummary: NotificationSummary = {
  unread_total: 0,
  all: 0,
  review: 0,
  availability: 0,
  price: 0,
  outgoing: 0,
  unread_review: 0,
  unread_availability: 0,
  unread_price: 0,
  afterbuy: 0,
  unread_afterbuy: 0,
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
  "price_negotiation_offer",
  "price_negotiation_response",
  "product_sold",
]);

const REVIEW_TYPES = new Set(["product_submitted_for_review", "product_change_requested"]);
const AVAILABILITY_TYPES = new Set([
  "product_confirmation",
  "product_availability_reminder",
  "product_deactivation_requested",
]);
const PRICE_TYPES = new Set(["price_negotiation_response"]);
const AFTERBUY_TYPES = new Set(["product_sold"]);
const LOCAL_AFTERBUY_MOCK_ID = -170917;
const SHOW_LOCAL_AFTERBUY_MOCK = process.env.NODE_ENV === "development";

function isLocalAfterbuyMock(message: Notification) {
  return message.id === LOCAL_AFTERBUY_MOCK_ID;
}

function localAfterbuyMock(
  t: (key: MessageKey, values?: Record<string, string | number>) => string,
  flags: { read: boolean; stockSynced: boolean; sellerNotified: boolean },
): Notification {
  const product = t("messages.afterbuyMockProduct");
  return {
    id: LOCAL_AFTERBUY_MOCK_ID,
    title: t("messages.afterbuyMockTitle"),
    body: t("messages.afterbuyMockBody", { name: product, qty: 2, soldAt: "17.09.2026 14:20" }),
    notification_type: "product_sold",
    product_id: 9001,
    product_title: product,
    product_status: "approved",
    seller_username: "demo_seller",
    seller_email: "seller@example.com",
    seller_name: "Demo Seller",
    sender_id: null,
    sender_username: "demo_seller",
    sender_email: "seller@example.com",
    sender_name: "Demo Seller",
    is_read: flags.read,
    created_at: new Date().toISOString(),
    afterbuy_marketplace: "otto",
    afterbuy_account: "jv",
    afterbuy_qty_sold: 2,
    afterbuy_stock_synced: flags.stockSynced,
    afterbuy_seller_notified: flags.sellerNotified,
  };
}

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

function senderIsSeller(message: Notification) {
  const senderUsername = message.sender_username?.trim().toLowerCase() || "";
  const sellerUsername = message.seller_username?.trim().toLowerCase() || "";
  if (senderUsername && sellerUsername && senderUsername === sellerUsername) return true;
  const senderEmail = message.sender_email?.trim().toLowerCase() || "";
  const sellerEmail = message.seller_email?.trim().toLowerCase() || "";
  return Boolean(senderEmail && sellerEmail && senderEmail === sellerEmail);
}

function managerLine(message: Notification) {
  const fromManagerFields = personLine(
    message.manager_name ?? null,
    message.manager_username ?? null,
    message.manager_email ?? null,
  );
  if (fromManagerFields) return fromManagerFields;
  if (senderIsSeller(message)) return "";
  return personLine(message.sender_name, message.sender_username, message.sender_email);
}

function productLabel(message: Notification) {
  return message.product_title?.trim() || (message.product_id ? `#${message.product_id}` : "");
}

function sellerCommentFromMessage(message: Notification) {
  const fromField = message.seller_comment?.trim() || "";
  if (fromField) return fromField;
  const marker = "__SELLER_COMMENT__";
  const body = message.body || "";
  if (!body.includes(marker)) return "";
  return body.split(marker).slice(1).join(marker).trim();
}

function visibleNotificationBody(message: Notification) {
  const body = message.body || "";
  const marker = "__SELLER_COMMENT__";
  if (!body.includes(marker)) return body.trim();
  return body.split(marker)[0].replace(/\n+$/g, "").trim();
}

function priceNegotiationAccepted(message: Notification): boolean | null {
  if (typeof message.price_accepted === "boolean") return message.price_accepted;
  const text = `${message.title} ${message.body}`.toLowerCase();
  if (
    text.includes("принят") ||
    text.includes("accepted") ||
    text.includes("akzeptiert") ||
    text.includes("kabul")
  ) {
    return true;
  }
  if (
    text.includes("отклон") ||
    text.includes("declined") ||
    text.includes("abgelehnt") ||
    text.includes("redded")
  ) {
    return false;
  }
  return null;
}

function afterbuyChannelLabel(message: Notification) {
  const marketplace = (message.afterbuy_marketplace || "").trim().toUpperCase();
  const account = (message.afterbuy_account || "").trim().toUpperCase();
  return [marketplace, account].filter(Boolean).join(" · ");
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

const PAGE_SIZE = 10;

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
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [mockFlags, setMockFlags] = useState({
    read: false,
    stockSynced: false,
    sellerNotified: false,
  });

  const showLocalAfterbuyMock = useMemo(() => {
    if (!SHOW_LOCAL_AFTERBUY_MOCK || page !== 1 || category === "outgoing") return false;
    if (category !== "all" && category !== "afterbuy") return false;
    if (unreadOnly && mockFlags.read) return false;
    if (!appliedSearch) return true;
    const needle = appliedSearch.toLowerCase();
    return (
      t("messages.afterbuyMockProduct").toLowerCase().includes(needle) ||
      t("messages.afterbuyMockTitle").toLowerCase().includes(needle) ||
      "afterbuy".includes(needle) ||
      "otto".includes(needle)
    );
  }, [appliedSearch, category, mockFlags.read, page, t, unreadOnly]);

  const displayMessages = useMemo(() => {
    if (!showLocalAfterbuyMock) return messages;
    return [localAfterbuyMock(t, mockFlags), ...messages];
  }, [messages, mockFlags, showLocalAfterbuyMock, t]);

  const displaySummary = useMemo(() => {
    if (!SHOW_LOCAL_AFTERBUY_MOCK) return summary;
    return {
      ...summary,
      all: summary.all + 1,
      afterbuy: summary.afterbuy + 1,
      unread_total: mockFlags.read ? summary.unread_total : summary.unread_total + 1,
      unread_afterbuy: mockFlags.read ? summary.unread_afterbuy : summary.unread_afterbuy + 1,
    };
  }, [mockFlags.read, summary]);

  const tabs = useMemo(
    () =>
      [
        {
          id: "all" as const,
          label: t("messages.tabAll"),
          count: unreadOnly ? displaySummary.unread_total : displaySummary.all,
          icon: Inbox,
        },
        {
          id: "review" as const,
          label: t("messages.tabReview"),
          count: unreadOnly ? displaySummary.unread_review : displaySummary.review,
          icon: ClipboardCheck,
        },
        {
          id: "availability" as const,
          label: t("messages.tabAvailability"),
          count: unreadOnly ? displaySummary.unread_availability : displaySummary.availability,
          icon: PackageSearch,
        },
        {
          id: "price" as const,
          label: t("messages.tabPrice"),
          count: unreadOnly ? displaySummary.unread_price : displaySummary.price,
          icon: Handshake,
        },
        {
          id: "afterbuy" as const,
          label: t("messages.tabAfterbuy"),
          count: unreadOnly ? displaySummary.unread_afterbuy : displaySummary.afterbuy,
          icon: ShoppingBag,
        },
        {
          id: "outgoing" as const,
          label: t("messages.tabOutgoing"),
          count: unreadOnly ? displaySummary.unread_outgoing : displaySummary.outgoing,
          icon: Send,
        },
      ] as const,
    [displaySummary, t, unreadOnly],
  );

  useEffect(() => {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return void window.location.replace("/manager/login");

    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
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
    if (isLocalAfterbuyMock(message)) {
    if (!message.is_read) {
        setMockFlags((current) => ({ ...current, read: true }));
      }
      return;
    }
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
          unread_price: PRICE_TYPES.has(message.notification_type)
            ? Math.max(0, current.unread_price - 1)
            : current.unread_price,
          unread_afterbuy: AFTERBUY_TYPES.has(message.notification_type)
            ? Math.max(0, current.unread_afterbuy - 1)
            : current.unread_afterbuy,
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
    setMockFlags((current) => ({ ...current, read: true }));
    setSummary((current) => ({
      ...current,
      unread_total: 0,
      unread_review: 0,
      unread_availability: 0,
      unread_price: 0,
      unread_afterbuy: 0,
    }));
  }

  async function syncAfterbuyStock(message: Notification) {
    setActionBusyId(message.id);
    setError("");
    setFeedback("");
    if (isLocalAfterbuyMock(message)) {
      setMockFlags((current) => ({ ...current, stockSynced: true }));
      setFeedback(t("messages.afterbuySyncSent"));
      setActionBusyId(null);
      return;
    }
    try {
      const response = await authorizedFetch(`/api/v1/notifications/${message.id}/afterbuy-sync-stock/`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        notification?: Notification;
        detail?: string;
      };
      if (!response.ok) throw new Error(apiErrorMessage(data, t("messages.afterbuySyncFailed")));
      setMessages((items) =>
        items.map((item) =>
          item.id === message.id
            ? { ...item, ...(data.notification ?? {}), afterbuy_stock_synced: true }
            : item,
        ),
      );
      setFeedback(t("messages.afterbuySyncSent"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("messages.afterbuySyncFailed"));
    } finally {
      setActionBusyId(null);
    }
  }

  async function notifyAfterbuySeller(message: Notification) {
    setActionBusyId(message.id);
    setError("");
    setFeedback("");
    if (isLocalAfterbuyMock(message)) {
      setMockFlags((current) => ({ ...current, sellerNotified: true }));
      setFeedback(t("messages.afterbuyNotifySent"));
      setActionBusyId(null);
      return;
    }
    try {
      const response = await authorizedFetch(`/api/v1/notifications/${message.id}/afterbuy-notify-seller/`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, t("messages.afterbuyNotifyFailed")));
      setMessages((items) =>
        items.map((item) => (item.id === message.id ? { ...item, afterbuy_seller_notified: true } : item)),
      );
      setFeedback(t("messages.afterbuyNotifySent"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("messages.afterbuyNotifyFailed"));
    } finally {
      setActionBusyId(null);
    }
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
        sellerComment: message.seller_comment?.trim() || "",
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
        sellerComment: sellerCommentFromMessage(message),
      };
    }

    if (message.notification_type === "price_negotiation_offer") {
      const status = message.price_negotiation_status;
      const accepted = priceNegotiationAccepted(message);
      const superseded = status === "superseded";
      return {
        badge: superseded ? t("status.superseded") : typeLabel(message.notification_type),
        badgeClass: superseded
          ? "bg-secondary text-muted-foreground"
          : accepted === true
            ? "bg-[var(--ui-success-bg)] text-[var(--ui-success)]"
            : accepted === false
              ? "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]"
              : badgeTone(message.notification_type),
        title: message.title || typeLabel(message.notification_type),
        titleClass: superseded ? "text-muted-foreground" : "",
        body: visibleNotificationBody(message) || t("messages.noDetails"),
        sellerComment: sellerCommentFromMessage(message),
      };
    }

    if (message.notification_type === "price_negotiation_response") {
      const accepted = priceNegotiationAccepted(message);
      return {
        badge: typeLabel(message.notification_type),
        badgeClass:
          accepted === true
            ? "bg-[var(--ui-success-bg)] text-[var(--ui-success)]"
            : accepted === false
              ? "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]"
              : badgeTone(message.notification_type),
        title: message.title || typeLabel(message.notification_type),
        titleClass:
          accepted === true
            ? "text-[var(--ui-success)]"
            : accepted === false
              ? "text-[var(--ui-danger)]"
              : "",
        body: visibleNotificationBody(message) || t("messages.noDetails"),
        sellerComment: sellerCommentFromMessage(message),
      };
    }

    return {
      badge: typeLabel(message.notification_type),
      badgeClass: badgeTone(message.notification_type),
      title: message.title || typeLabel(message.notification_type),
      body: visibleNotificationBody(message) || t("messages.noDetails"),
      sellerComment: sellerCommentFromMessage(message),
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
    if (type === "price_negotiation_offer") {
      return "bg-[var(--ui-orange-soft)] text-[#c56a12]";
    }
    if (type === "price_negotiation_response") {
      return "bg-[var(--ui-warn-bg)] text-[var(--ui-warn)]";
    }
    if (type === "product_sold") {
      return "bg-[var(--ui-orange-soft)] text-[#c56a12]";
    }
    return "bg-secondary text-muted-foreground";
  }

  const unreadHint =
    category === "outgoing"
      ? displaySummary.unread_outgoing
      : category === "review"
        ? displaySummary.unread_review
        : category === "availability"
          ? displaySummary.unread_availability
          : category === "price"
            ? displaySummary.unread_price
            : category === "afterbuy"
              ? displaySummary.unread_afterbuy
            : displaySummary.unread_total;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("common.panel")}
        title={t("messages.title")}
        description={t("messages.subtitle")}
        primaryAction={
          category === "outgoing" ? null : (
            <Button variant="secondary" disabled={!displaySummary.unread_total} onClick={() => void readAll()}>
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
        {feedback ? <Feedback className="px-5 py-4 text-[var(--ui-success)]">{feedback}</Feedback> : null}
        {!loading && !error && displayMessages.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={unreadOnly ? t("messages.emptyUnread") : appliedSearch ? t("messages.emptySearch") : t("messages.empty")}
          />
        ) : null}

        {!loading && !error && displayMessages.length > 0 ? (
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
              {displayMessages.map((message) => {
                const seller = sellerLine(message);
                const manager = managerLine(message);
                const product = productLabel(message);
                const presentation = messagePresentation(message);
                const outgoingUnread = category === "outgoing" && !message.is_read;
                if (message.notification_type === "product_sold") {
                  const channel = afterbuyChannelLabel(message);
                  return (
                    <article
                      key={message.id}
                      className={cn(
                        "px-5 py-4 transition-colors",
                        message.is_read ? "bg-card" : "bg-[rgba(247,148,29,0.05)]",
                      )}
                    >
                      <div className="rounded-2xl border border-[rgba(247,148,29,0.22)] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(20,47,85,0.04)]">
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-1.5 size-2.5 shrink-0 rounded-full",
                              message.is_read ? "bg-border" : "bg-[var(--brand-accent)]",
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              className="w-full cursor-pointer text-left"
                              onClick={() => void openMessage(message)}
                            >
                              <span className="flex items-start justify-between gap-3">
                                <span className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-extrabold", presentation.badgeClass)}>
                                    {presentation.badge}
                                  </span>
                                  {!message.is_read ? (
                                    <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--brand-accent)]">
                                      {t("messages.newBadge")}
                                    </span>
                                  ) : null}
                                  {channel ? (
                                    <span className="rounded-md bg-[#f4f7fb] px-2 py-0.5 text-[11px] font-extrabold text-[#142f55]">
                                      {channel}
                                    </span>
                                  ) : null}
                                  {message.afterbuy_qty_sold != null ? (
                                    <span className="rounded-md bg-[#fff4e8] px-2 py-0.5 text-[11px] font-extrabold text-[#c56a12]">
                                      {t("messages.afterbuyQtyChip", { qty: message.afterbuy_qty_sold })}
                                    </span>
                                  ) : null}
                                </span>
                                <time
                                  className="shrink-0 pt-0.5 text-[11px] font-semibold leading-4 text-muted-foreground"
                                  dateTime={message.created_at}
                                >
                                  {formatDate(message.created_at, true)}
                                </time>
                              </span>
                              <strong className="mt-2 block text-[15px] font-extrabold text-primary">
                                {presentation.title}
                              </strong>
                              {message.product_id ? (
                                <em className="mt-1 block text-sm font-bold not-italic text-[#142f55]">
                                  #{message.product_id}
                                  {message.product_title ? ` · ${message.product_title}` : ""}
                                </em>
                              ) : null}
                              {seller ? (
                                <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                                  <span className="font-extrabold text-primary">{t("messages.sellerLabel")}</span>{" "}
                                  {seller}
                                </span>
                              ) : null}
                            </button>
                            <div className="mt-4 flex gap-2 border-t border-[rgba(247,148,29,0.16)] pt-3">
                              <Button
                                type="button"
                                variant="accent"
                                size="sm"
                                className="h-9 min-w-0 flex-1 px-2"
                                disabled={actionBusyId === message.id || Boolean(message.afterbuy_stock_synced)}
                                onClick={() => void syncAfterbuyStock(message)}
                              >
                                {message.afterbuy_stock_synced
                                  ? t("messages.afterbuySyncDone")
                                  : t("messages.afterbuySync")}
                              </Button>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="h-9 min-w-0 flex-1 px-2"
                                disabled={actionBusyId === message.id || Boolean(message.afterbuy_seller_notified)}
                                onClick={() => void notifyAfterbuySeller(message)}
                              >
                                {message.afterbuy_seller_notified
                                  ? t("messages.afterbuyNotifyDone")
                                  : t("messages.afterbuyNotify")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }
                return (
                  <article
                    key={message.id}
                    className={cn(
                      "flex items-start gap-4 px-5 py-4 transition-colors",
                      message.price_negotiation_status === "superseded"
                        ? "bg-card text-muted-foreground"
                        : message.is_read
                          ? "bg-card"
                          : "bg-[rgba(247,148,29,0.04)]",
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
                        <strong
                          className={cn(
                            "block text-sm font-extrabold",
                            "titleClass" in presentation && presentation.titleClass
                              ? presentation.titleClass
                              : "text-primary",
                          )}
                        >
                          {presentation.title}
                        </strong>
                        <small
                          className={cn(
                            "block text-sm text-muted-foreground",
                            message.notification_type === "product_sold" && "whitespace-pre-line",
                          )}
                        >
                          {highlightProduct(presentation.body, product)}
                        </small>
                        {"sellerComment" in presentation && presentation.sellerComment ? (
                          <div className="mt-2 rounded-xl border border-[rgba(247,148,29,0.28)] bg-[#fff8f0] px-3 py-2.5">
                            <span className="block text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--brand-accent)]">
                              {t("messages.sellerComment")}
                            </span>
                            <p className="mt-1 text-sm font-semibold text-primary">{presentation.sellerComment}</p>
                          </div>
                        ) : null}
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
