"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Send } from "lucide-react";

import { Feedback, SectionCard, SectionCardHeader } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import {
  ensureOttoListingDefaults,
  formatListingErrors,
  listingChannelLabel,
  listingPreviewPath,
  listingTargetKey,
  listingTargets,
} from "@/lib/listings";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

type Target = (typeof listingTargets)[number];
type Publication = {
  marketplace: string;
  account: string;
  status: string;
};

type Job = {
  id: string;
  operation: string;
};

function redirectIfUnauthorized(status: number) {
  if (status !== 401) return false;
  window.localStorage.removeItem("benim_access_token");
  window.localStorage.removeItem("benim_refresh_token");
  window.location.replace("/manager/login");
  return true;
}

function isLivePublication(status: string) {
  return status === "active";
}

export function ProductPublishPanel({
  productId,
  productStatus,
}: {
  productId: number;
  productStatus?: string;
}) {
  const { t } = useI18n();
  const [selectedTargets, setSelectedTargets] = useState(() => listingTargets.map(listingTargetKey));
  const [publishing, setPublishing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previews, setPreviews] = useState<Array<{ key: string; label: string; ok: boolean; detail: string }>>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fetchedStatus, setFetchedStatus] = useState("");
  const [publications, setPublications] = useState<Publication[]>([]);
  const status = productStatus || fetchedStatus;

  const loadPublications = useCallback(async () => {
    const response = await authorizedFetch(`/api/v1/orchestrator/products/${productId}/publications/`);
    if (redirectIfUnauthorized(response.status) || !response.ok) return;
    const body = await response.json();
    const rows: Publication[] = Array.isArray(body) ? body : body.results ?? [];
    setPublications(rows);
  }, [productId]);

  useEffect(() => {
    if (productStatus) return;
    let cancelled = false;
    async function loadStatus() {
      const response = await authorizedFetch(`/api/v1/products/${productId}/`);
      if (cancelled || redirectIfUnauthorized(response.status) || !response.ok) return;
      const data = (await response.json()) as { status?: string };
      if (!cancelled && data.status) setFetchedStatus(data.status);
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [productId, productStatus]);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  const canPublish = status === "approved";
  const publicationByTarget = useMemo(() => {
    const map = new Map<string, Publication>();
    for (const publication of publications) {
      map.set(`${publication.marketplace}:${publication.account}`, publication);
    }
    return map;
  }, [publications]);

  const selectedLiveTargets = useMemo(
    () =>
      listingTargets.filter((target) => {
        const key = listingTargetKey(target);
        if (!selectedTargets.includes(key)) return false;
        const publication = publicationByTarget.get(key);
        return Boolean(publication && isLivePublication(publication.status));
      }),
    [publicationByTarget, selectedTargets],
  );

  const hasAnyLivePublication = useMemo(
    () => publications.some((publication) => isLivePublication(publication.status)),
    [publications],
  );

  const canUpdate = canPublish && hasAnyLivePublication && selectedLiveTargets.length > 0;

  function toggleTarget(target: Target) {
    const key = listingTargetKey(target);
    setPreviews([]);
    setSelectedTargets((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  async function queueJob(operation: "publish" | "update", targets: Target[]) {
    const response = await authorizedFetch(`/api/v1/orchestrator/products/${productId}/${operation}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ targets }),
    });
    if (redirectIfUnauthorized(response.status)) return null;
    if (!response.ok) {
      setError(
        apiErrorMessage(
          await response.json().catch(() => null),
          operation === "update" ? t("listing.updateError") : t("marketplaces.publishError"),
        ),
      );
      return null;
    }
    return (await response.json()) as Job;
  }

  async function publish() {
    if (!canPublish || selectedTargets.length === 0) return;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      await ensureOttoListingDefaults(productId, authorizedFetch);
      const job = await queueJob(
        "publish",
        listingTargets.filter((target) => selectedTargets.includes(listingTargetKey(target))),
      );
      if (!job) return;
      setNotice(
        t("marketplaces.jobQueued", {
          id: job.id.slice(0, 8),
          operation: t(`job.op.${job.operation}` as MessageKey),
        }),
      );
      await loadPublications();
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setPublishing(false);
    }
  }

  async function updateLive() {
    if (!canUpdate) return;
    if (!window.confirm(t("listing.confirmUpdate"))) return;
    setUpdating(true);
    setError("");
    setNotice("");
    try {
      await ensureOttoListingDefaults(productId, authorizedFetch);
      // OTTO update still uses the marketplace upsert under the hood, but the
      // Benim job operation is `update` so Marketplaces history shows it correctly.
      const job = await queueJob("update", selectedLiveTargets);
      if (!job) return;
      setNotice(
        t("marketplaces.jobQueued", {
          id: job.id.slice(0, 8),
          operation: t(`job.op.${job.operation}` as MessageKey),
        }),
      );
      await loadPublications();
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setUpdating(false);
    }
  }

  async function previewSelected() {
    if (selectedTargets.length === 0) return;
    setPreviewing(true);
    setError("");
    setNotice("");
    try {
      await ensureOttoListingDefaults(productId, authorizedFetch);
      const publicationResponse = await authorizedFetch(`/api/v1/orchestrator/products/${productId}/publications/`);
      const publicationBody = publicationResponse.ok ? await publicationResponse.json() : [];
      const productPublications: Publication[] = Array.isArray(publicationBody)
        ? publicationBody
        : publicationBody.results ?? [];
      setPublications(productPublications);
      const selected = listingTargets.filter((target) => selectedTargets.includes(listingTargetKey(target)));
      const rows = await Promise.all(
        selected.map(async (target) => {
          const publication = productPublications.find(
            (item) => item.marketplace === target.marketplace && item.account === target.account,
          );
          const kauflandMode =
            publication && publication.status !== "deleted" && publication.status !== "failed" ? "update" : "create";
          const response = await authorizedFetch(listingPreviewPath(productId, target, kauflandMode));
          const data = await response.json().catch(() => null);
          if (redirectIfUnauthorized(response.status)) {
            return { key: listingTargetKey(target), label: listingChannelLabel(target), ok: false, detail: "" };
          }
          if (!response.ok) {
            return {
              key: listingTargetKey(target),
              label: listingChannelLabel(target),
              ok: false,
              detail: formatListingErrors(data?.errors) || apiErrorMessage(data, t("listing.previewNotReady")),
            };
          }
          return {
            key: listingTargetKey(target),
            label: listingChannelLabel(target),
            ok: true,
            detail: t("listing.previewOk"),
          };
        }),
      );
      setPreviews(rows);
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <SectionCard>
      <SectionCardHeader
        eyebrow={t("marketplaces.publication")}
        title={t("listing.publishPanelTitle")}
        description={t("listing.publishPanelHint")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/manager/marketplaces?q=${productId}`}>
              <ExternalLink className="size-3.5" />
              {t("listing.viewPublications")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 p-4 md:p-5">
        {!canPublish && status ? (
          <Feedback tone="warn">{t("listing.publishNeedsApproved")}</Feedback>
        ) : null}
        {error ? <Feedback>{error}</Feedback> : null}
        {notice ? <Feedback tone="success">{notice}</Feedback> : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm font-extrabold text-primary">{t("marketplaces.targets")}</strong>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-auto px-0 text-[var(--brand-accent)] hover:bg-transparent hover:underline"
            onClick={() => {
              setPreviews([]);
              setSelectedTargets(selectedTargets.length === listingTargets.length ? [] : listingTargets.map(listingTargetKey));
            }}
          >
            {selectedTargets.length === listingTargets.length ? t("marketplaces.clearAll") : t("marketplaces.selectAll")}
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {listingTargets.map((target) => {
            const key = listingTargetKey(target);
            const checked = selectedTargets.includes(key);
            const publication = publicationByTarget.get(key);
            const live = Boolean(publication && isLivePublication(publication.status));
            return (
              <label
                key={key}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold text-primary transition-colors",
                  checked && "border-[var(--brand-accent)] bg-[var(--ui-orange-soft)] shadow-[0_0_0_1px_rgba(247,148,29,0.22)]",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleTarget(target)}
                  aria-label={listingChannelLabel(target)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block">{listingChannelLabel(target)}</span>
                  {live ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ui-success)]">
                      {t("listing.channelActive")}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        <p className="text-xs font-semibold text-muted-foreground">{t("listing.previewAllHint")}</p>
        <p className="text-xs font-semibold text-muted-foreground">{t("listing.updateHint")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={selectedTargets.length === 0 || previewing}
            onClick={() => void previewSelected()}
          >
            {previewing ? t("listing.previewing") : t("listing.previewAll")}
          </Button>
          <Button
            variant="accent"
            disabled={!canPublish || selectedTargets.length === 0 || publishing || updating}
            onClick={() => void publish()}
          >
            <Send className="size-4" />
            {publishing
              ? t("marketplaces.queueing")
              : selectedTargets.length === 1
                ? t("marketplaces.publish", { count: selectedTargets.length })
                : t("marketplaces.publishPlural", { count: selectedTargets.length })}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canUpdate || publishing || updating}
            title={
              !hasAnyLivePublication
                ? t("listing.updateDisabledNoActive")
                : selectedLiveTargets.length === 0
                  ? t("listing.updateDisabledNoSelected")
                  : undefined
            }
            onClick={() => void updateLive()}
          >
            <RefreshCw className="size-4" />
            {updating
              ? t("marketplaces.queueing")
              : selectedLiveTargets.length > 0
                ? t("listing.update", { count: selectedLiveTargets.length })
                : t("listing.updateIdle")}
          </Button>
          <span className="text-xs font-semibold text-muted-foreground">{t("marketplaces.queuedHint")}</span>
        </div>

        {previews.length > 0 ? (
          <div className="grid gap-2">
            {previews.map((row) => (
              <article
                key={row.key}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2",
                  row.ok
                    ? "border-[rgba(34,140,90,0.28)] bg-[var(--ui-success-bg)]"
                    : "border-[rgba(196,64,56,0.28)] bg-[var(--ui-danger-bg)]",
                )}
              >
                <strong className="text-sm font-extrabold text-primary">{row.label}</strong>
                <span className={cn("text-xs font-bold", row.ok ? "text-[var(--ui-success)]" : "text-[var(--ui-danger)]")}>
                  {row.detail}
                </span>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
