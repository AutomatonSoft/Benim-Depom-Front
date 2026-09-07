"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { formatListingErrors, listingChannelLabel, listingPreviewPath } from "@/lib/listings";
import { useI18n, type MessageKey } from "@/i18n";

type Marketplace = "hood" | "otto" | "kaufland";
type Account = "jv" | "xl";
type Target = { marketplace: Marketplace; account: Account };
type Product = { id: number; title: string; product_type: string };

type Publication = {
  id: number;
  product_id: number;
  product_title: string;
  marketplace: Marketplace;
  account: Account;
  ean: string;
  status: string;
  last_job_id: string | null;
  last_error: unknown;
  updated_at: string;
};

type Job = {
  id: string;
  product_id: number;
  product_title?: string;
  operation: string;
  status: string;
  in_progress: boolean;
  requested_channels: string[];
  requested_targets: Target[];
  error: unknown;
  created_at: string;
  finished_at: string | null;
};

type ListResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const targets: Target[] = [
  { marketplace: "otto", account: "jv" },
  { marketplace: "otto", account: "xl" },
  { marketplace: "hood", account: "jv" },
  { marketplace: "hood", account: "xl" },
  { marketplace: "kaufland", account: "jv" },
  { marketplace: "kaufland", account: "xl" },
];

const targetKey = (target: Target) => `${target.marketplace}:${target.account}`;
const marketplaceName: Record<Marketplace, string> = {
  otto: "OTTO",
  hood: "Hood",
  kaufland: "Kaufland",
};
const publicationStatusKeys = [
  "pending",
  "publishing",
  "active",
  "deactivating",
  "deactivated",
  "deleting",
  "deleted",
  "failed",
] as const;
const jobStatusKeys = [
  "queued",
  "running",
  "pending_confirmation",
  "succeeded",
  "partial",
  "failed",
] as const;
const operationKeys = ["publish", "update", "activate", "deactivate", "delete", "search"] as const;
const listingBusyStatuses = new Set(["pending", "publishing", "deactivating", "deleting"]);
const IN_FLIGHT_POLL_MS = 4000;

function jsonHint(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value as object).length === 0)) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "detail" in value && typeof value.detail === "string") return value.detail;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function redirectIfUnauthorized(status: number) {
  if (status !== 401) return false;
  window.localStorage.removeItem("benim_access_token");
  window.localStorage.removeItem("benim_refresh_token");
  window.location.replace("/manager/login");
  return true;
}

export default function MarketplacesPage() {
  const { t } = useI18n();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [publicationCount, setPublicationCount] = useState(0);
  const [publicationPage, setPublicationPage] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobCount, setJobCount] = useState(0);
  const [jobPage, setJobPage] = useState(1);
  const [inProgressJobs, setInProgressJobs] = useState<Job[]>([]);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [approvedProducts, setApprovedProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedTargets, setSelectedTargets] = useState(() => targets.map(targetKey));
  const [marketplace, setMarketplace] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [jobOperation, setJobOperation] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [appliedProductFilter, setAppliedProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previews, setPreviews] = useState<Array<{ key: string; label: string; ok: boolean; detail: string }>>([]);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const silentReload = useRef(false);

  const listingBusy = useMemo(
    () => publications.some((item) => listingBusyStatuses.has(item.status)),
    [publications],
  );
  const shouldPoll = inProgressCount > 0 || listingBusy;

  useEffect(() => {
    setPreviews([]);
  }, [selectedProductId, selectedTargets]);

  useEffect(() => {
    async function loadData() {
      const access = window.localStorage.getItem("benim_access_token");
      if (!access) return void window.location.replace("/manager/login");

      if (!silentReload.current) setLoading(true);
      setError("");
      const publicationParams = new URLSearchParams({ page: String(publicationPage) });
      const jobParams = new URLSearchParams({ page: String(jobPage) });
      if (marketplace) publicationParams.set("marketplace", marketplace);
      if (account) publicationParams.set("account", account);
      if (status) publicationParams.set("status", status);
      if (appliedProductFilter) {
        publicationParams.set("product_id", appliedProductFilter);
        jobParams.set("product_id", appliedProductFilter);
      }
      if (jobStatus) jobParams.set("status", jobStatus);
      if (jobOperation) jobParams.set("operation", jobOperation);

      try {
        const [
          publicationResponse,
          productResponse,
          jobsResponse,
          inProgressResponse,
          activeResponse,
          failedResponse,
        ] = await Promise.all([
          authorizedFetch(`/api/v1/orchestrator/publications/?${publicationParams}`),
          authorizedFetch("/api/v1/manager/products/?status=approved&page=1&page_size=100"),
          authorizedFetch(`/api/v1/orchestrator/jobs/?${jobParams}`),
          authorizedFetch("/api/v1/orchestrator/jobs/?in_progress=true&page=1"),
          authorizedFetch("/api/v1/orchestrator/publications/?status=active&page=1"),
          authorizedFetch("/api/v1/orchestrator/publications/?status=failed&page=1"),
        ]);
        const responses = [
          publicationResponse,
          productResponse,
          jobsResponse,
          inProgressResponse,
          activeResponse,
          failedResponse,
        ];
        if (responses.some((response) => redirectIfUnauthorized(response.status))) return;
        if (responses.some((response) => !response.ok)) throw new Error();

        const publicationData = (await publicationResponse.json()) as ListResponse<Publication>;
        const jobData = (await jobsResponse.json()) as ListResponse<Job>;
        const inProgressData = (await inProgressResponse.json()) as ListResponse<Job>;
        setPublications(publicationData.results);
        setPublicationCount(publicationData.count);
        setJobs(jobData.results);
        setJobCount(jobData.count);
        setInProgressJobs(inProgressData.results);
        setInProgressCount(inProgressData.count);
        setActiveCount(((await activeResponse.json()) as ListResponse<Publication>).count);
        setFailedCount(((await failedResponse.json()) as ListResponse<Publication>).count);
        setApprovedProducts(((await productResponse.json()) as ListResponse<Product>).results);
      } catch {
        setError(t("marketplaces.loadError"));
      } finally {
        silentReload.current = false;
        setLoading(false);
      }
    }

    void loadData();
  }, [
    marketplace,
    account,
    status,
    jobStatus,
    jobOperation,
    appliedProductFilter,
    publicationPage,
    jobPage,
    reloadKey,
    t,
  ]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      silentReload.current = true;
      setReloadKey((value) => value + 1);
    }, IN_FLIGHT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [shouldPoll]);

  function toggleTarget(target: Target) {
    const key = targetKey(target);
    setSelectedTargets((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function queuedNotice(job: Job) {
    return t("marketplaces.jobQueued", {
      id: job.id.slice(0, 8),
      operation: t(`job.op.${job.operation}` as MessageKey),
    });
  }

  async function postJob(path: string, body: unknown) {
    const response = await authorizedFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    if (redirectIfUnauthorized(response.status)) return null;
    if (!response.ok) {
      setError(apiErrorMessage(await response.json().catch(() => null), t("marketplaces.actionError")));
      return null;
    }
    return response.json();
  }

  async function publish() {
    if (!selectedProductId || selectedTargets.length === 0) return;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const data = await postJob(`/api/v1/orchestrator/products/${selectedProductId}/publish/`, {
        targets: targets.filter((target) => selectedTargets.includes(targetKey(target))),
      });
      if (!data) return;
      setNotice(queuedNotice(data as Job));
      setReloadKey((value) => value + 1);
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setPublishing(false);
    }
  }

  async function previewSelected() {
    if (!selectedProductId || selectedTargets.length === 0) return;
    setPreviewing(true);
    setError("");
    setNotice("");
    try {
      const productId = Number(selectedProductId);
      const publicationResponse = await authorizedFetch(`/api/v1/orchestrator/products/${productId}/publications/`);
      const publicationBody = publicationResponse.ok ? await publicationResponse.json() : [];
      const productPublications: Publication[] = Array.isArray(publicationBody)
        ? publicationBody
        : publicationBody.results ?? [];
      const selected = targets.filter((target) => selectedTargets.includes(targetKey(target)));
      const rows = await Promise.all(
        selected.map(async (target) => {
          const publication = productPublications.find(
            (item) => item.marketplace === target.marketplace && item.account === target.account,
          );
          const kauflandMode =
            publication && publication.status !== "deleted" && publication.status !== "failed"
              ? "update"
              : "create";
          const response = await authorizedFetch(listingPreviewPath(productId, target, kauflandMode));
          const data = await response.json().catch(() => null);
          if (redirectIfUnauthorized(response.status)) {
            return { key: targetKey(target), label: listingChannelLabel(target), ok: false, detail: "" };
          }
          if (!response.ok) {
            return {
              key: targetKey(target),
              label: listingChannelLabel(target),
              ok: false,
              detail: formatListingErrors(data?.errors) || apiErrorMessage(data, t("listing.previewNotReady")),
            };
          }
          return {
            key: targetKey(target),
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

  async function runListingAction(
    publication: Publication,
    action: "update" | "deactivate" | "activate" | "delete" | "publish",
  ) {
    const pair = { marketplace: publication.marketplace, account: publication.account };
    const confirms: Record<typeof action, string> = {
      update: t("marketplaces.confirmUpdate", { marketplace: marketplaceName[publication.marketplace] }),
      deactivate:
        publication.marketplace === "otto"
          ? t("marketplaces.confirmDeactivateOtto")
          : t("marketplaces.confirmDeactivateDelete", {
              marketplace: marketplaceName[publication.marketplace],
            }),
      activate: t("marketplaces.confirmActivate"),
      delete: t("marketplaces.confirmDelete", { marketplace: marketplaceName[publication.marketplace] }),
      publish: t("marketplaces.confirmPublish"),
    };
    if (!window.confirm(confirms[action])) return;

    const key = `${publication.id}:${action}`;
    setBusyKey(key);
    setError("");
    setNotice("");
    try {
      let data: unknown = null;
      if (action === "deactivate" || action === "activate") {
        data = await postJob(`/api/v1/orchestrator/products/${publication.product_id}/listing-state/`, {
          action,
          targets: [pair],
        });
        if (data && typeof data === "object" && "jobs" in data) {
          const jobsCreated = (data as { jobs: Job[] }).jobs;
          if (jobsCreated[0]) setNotice(queuedNotice(jobsCreated[0]));
        }
      } else {
        data = await postJob(`/api/v1/orchestrator/products/${publication.product_id}/${action}/`, {
          targets: [pair],
        });
        if (data) setNotice(queuedNotice(data as Job));
      }
      if (data) setReloadKey((value) => value + 1);
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setBusyKey("");
    }
  }

  function linkedCopy(text: string, href: string, label: string) {
    const [before, after = ""] = text.split("{link}");
    return (
      <span>
        {before}
        <Link href={href}>{label}</Link>
        {after}
      </span>
    );
  }

  function listingActions(publication: Publication) {
    const busy = listingBusyStatuses.has(publication.status) || Boolean(busyKey);
    const isBusy = (action: string) => busyKey === `${publication.id}:${action}`;
    if (listingBusyStatuses.has(publication.status)) {
      return <span className="listing-wait">{t("marketplaces.waitingMarketplace")}</span>;
    }
    return (
      <div className="listing-actions">
        {publication.status === "active" && (
          <>
            <button disabled={busy} onClick={() => void runListingAction(publication, "update")}>
              {isBusy("update") ? t("marketplaces.queueing") : t("marketplaces.actionUpdate")}
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => void runListingAction(publication, "deactivate")}
            >
              {isBusy("deactivate")
                ? t("marketplaces.queueing")
                : publication.marketplace === "otto"
                  ? t("marketplaces.actionDeactivate")
                  : t("marketplaces.actionTakeDown")}
            </button>
          </>
        )}
        {publication.status === "deactivated" && publication.marketplace === "otto" && (
          <button disabled={busy} onClick={() => void runListingAction(publication, "activate")}>
            {isBusy("activate") ? t("marketplaces.queueing") : t("marketplaces.actionActivate")}
          </button>
        )}
        {(publication.status === "failed" || publication.status === "deleted") && (
          <button disabled={busy} onClick={() => void runListingAction(publication, "publish")}>
            {isBusy("publish") ? t("marketplaces.queueing") : t("marketplaces.actionRetry")}
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="content marketplaces-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("common.panel")}</p>
          <h1>{t("marketplaces.title")}</h1>
          <p className="products-subtitle">{t("marketplaces.subtitle")}</p>
        </div>
        <button className="refresh-button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
          {shouldPoll ? t("marketplaces.autoRefresh") : t("common.refresh")}
        </button>
      </header>

      <section className="marketplace-stats">
        <article>
          <span>{t("marketplaces.statJobs")}</span>
          <strong>{inProgressCount}</strong>
          <small>{t("marketplaces.statJobsHint")}</small>
        </article>
        <article>
          <span>{t("marketplaces.statActive")}</span>
          <strong>{activeCount}</strong>
          <small>{t("marketplaces.statActiveHint")}</small>
        </article>
        <article>
          <span>{t("marketplaces.statFailed")}</span>
          <strong>{failedCount}</strong>
          <small>{t("marketplaces.statFailedHint")}</small>
        </article>
        <article>
          <span>{t("marketplaces.statListings")}</span>
          <strong>{publicationCount}</strong>
          <small>{t("marketplaces.statListingsHint")}</small>
        </article>
      </section>

      {inProgressJobs.length > 0 && (
        <section className="products-panel marketplace-jobs in-flight">
          <div className="marketplace-list-heading">
            <div>
              <p className="eyebrow">{t("marketplaces.jobsLive")}</p>
              <h2>{t("marketplaces.jobsLiveTitle")}</h2>
            </div>
            <span className="jobs-live-badge">{t("marketplaces.jobsLiveBadge")}</span>
          </div>
          <div className="job-table">
            <div className="job-header">
              <span>{t("marketplaces.col.product")}</span>
              <span>{t("marketplaces.col.operation")}</span>
              <span>{t("marketplaces.col.targets")}</span>
              <span>{t("marketplaces.col.status")}</span>
              <span>{t("marketplaces.col.started")}</span>
            </div>
            {inProgressJobs.map((job) => (
              <article key={job.id}>
                <div>
                  <Link href={`/manager/products/${job.product_id}`}>
                    <strong>{job.product_title || `#${job.product_id}`}</strong>
                  </Link>
                  <small>#{job.product_id}</small>
                </div>
                <span>{t(`job.op.${job.operation}` as MessageKey)}</span>
                <span>{(job.requested_targets || []).map(targetKey).join(" · ") || job.requested_channels.join(", ")}</span>
                <span className={`job-status ${job.status}`}>{t(`job.${job.status}` as MessageKey)}</span>
                <time dateTime={job.created_at}>{formatDate(job.created_at, true)}</time>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="marketplace-workflow">
        <article>
          <b>1</b>
          <div>
            <strong>{t("marketplaces.step1Title")}</strong>
            {linkedCopy(t("marketplaces.step1"), "/manager/messages", t("nav.messages"))}
          </div>
        </article>
        <article>
          <b>2</b>
          <div>
            <strong>{t("marketplaces.step2Title")}</strong>
            {linkedCopy(t("marketplaces.step2"), "/manager/products", t("nav.products"))}
          </div>
        </article>
        <article>
          <b>3</b>
          <div>
            <strong>{t("marketplaces.step3Title")}</strong>
            <span>{t("marketplaces.step3")}</span>
          </div>
        </article>
        <article>
          <b>4</b>
          <div>
            <strong>{t("marketplaces.step4Title")}</strong>
            <span>{t("marketplaces.step4")}</span>
          </div>
        </article>
      </section>

      <section className="publish-card">
        <div className="publish-card-heading">
          <div>
            <p className="eyebrow">{t("marketplaces.publication")}</p>
            <h2>{t("marketplaces.publishTitle")}</h2>
          </div>
          <span>{t("marketplaces.queuedHint")}</span>
        </div>
        <div className="publish-controls">
          <label>
            {t("marketplaces.approvedProduct")}
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
              <option value="">{t("marketplaces.selectProduct")}</option>
              {approvedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  #{product.id} · {product.title || product.product_type}
                </option>
              ))}
            </select>
          </label>
          <div className="target-picker">
            <div className="target-picker-heading">
              <strong>{t("marketplaces.targets")}</strong>
              <button
                type="button"
                onClick={() =>
                  setSelectedTargets(selectedTargets.length === targets.length ? [] : targets.map(targetKey))
                }
              >
                {selectedTargets.length === targets.length ? t("marketplaces.clearAll") : t("marketplaces.selectAll")}
              </button>
            </div>
            <div className="target-grid">
              {targets.map((target) => (
                <label key={targetKey(target)}>
                  <input
                    checked={selectedTargets.includes(targetKey(target))}
                    onChange={() => toggleTarget(target)}
                    type="checkbox"
                  />
                  <span>
                    {marketplaceName[target.marketplace]} <small>{target.account.toUpperCase()}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <p className="ai-draft-hint listing-publish-hint">{t("listing.previewAllHint")}</p>
        <div className="listing-prep-actions">
          <button
            type="button"
            className="listing-preview-button"
            disabled={!selectedProductId || selectedTargets.length === 0 || previewing}
            onClick={() => void previewSelected()}
          >
            {previewing ? t("listing.previewing") : t("listing.previewAll")}
          </button>
          <button
            className="publish-button"
            disabled={!selectedProductId || selectedTargets.length === 0 || publishing}
            onClick={() => void publish()}
          >
            {publishing
              ? t("marketplaces.queueing")
              : selectedTargets.length === 1
                ? t("marketplaces.publish", { count: selectedTargets.length })
                : t("marketplaces.publishPlural", { count: selectedTargets.length })}
          </button>
        </div>
        {selectedProductId ? (
          <Link className="listing-open-marketplaces" href={`/manager/products/${selectedProductId}`}>
            {t("listing.editOnProduct")}
          </Link>
        ) : null}
        {previews.length > 0 && (
          <div className="publish-previews">
            {previews.map((row) => (
              <article key={row.key} className={`publish-preview-row ${row.ok ? "is-ok" : "is-bad"}`}>
                <strong>{row.label}</strong>
                <span>{row.detail}</span>
              </article>
            ))}
          </div>
        )}
        </div>
        {error && (
          <p className="form-feedback error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="form-feedback success" role="status">
            {notice}
          </p>
        )}
      </section>

      <form
        className="marketplace-search"
        onSubmit={(event) => {
          event.preventDefault();
          setPublicationPage(1);
          setJobPage(1);
          setAppliedProductFilter(productFilter.trim());
        }}
      >
        <label>
          {t("marketplaces.productFilter")}
          <input
            inputMode="numeric"
            placeholder={t("marketplaces.productFilterPlaceholder")}
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value.replace(/\D/g, ""))}
          />
        </label>
        <button type="submit">{t("common.search")}</button>
      </form>

      <section className="products-panel marketplace-list">
        <div className="marketplace-list-heading">
          <div>
            <p className="eyebrow">{t("marketplaces.listingStatus")}</p>
            <h2>{t("marketplaces.recent")}</h2>
          </div>
          <div className="marketplace-filters">
            <select
              aria-label={t("marketplaces.filterMarketplace")}
              value={marketplace}
              onChange={(event) => {
                setPublicationPage(1);
                setMarketplace(event.target.value);
              }}
            >
              <option value="">{t("marketplaces.allMarketplaces")}</option>
              <option value="otto">OTTO</option>
              <option value="hood">Hood</option>
              <option value="kaufland">Kaufland</option>
            </select>
            <select
              aria-label={t("marketplaces.filterAccount")}
              value={account}
              onChange={(event) => {
                setPublicationPage(1);
                setAccount(event.target.value);
              }}
            >
              <option value="">{t("marketplaces.allAccounts")}</option>
              <option value="jv">JV</option>
              <option value="xl">XL</option>
            </select>
            <select
              aria-label={t("marketplaces.filterStatus")}
              value={status}
              onChange={(event) => {
                setPublicationPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">{t("marketplaces.allStatuses")}</option>
              {publicationStatusKeys.map((value) => (
                <option key={value} value={value}>
                  {t(`pub.${value}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading && publications.length === 0 && <p className="products-message">{t("marketplaces.loading")}</p>}
        {!loading && !error && publications.length === 0 && (
          <p className="products-message">{t("marketplaces.empty")}</p>
        )}
        {publications.length > 0 && (
          <div className="publication-table">
            <div className="publication-header">
              <span>{t("marketplaces.col.product")}</span>
              <span>{t("marketplaces.col.marketplace")}</span>
              <span>{t("marketplaces.col.ean")}</span>
              <span>{t("marketplaces.col.status")}</span>
              <span>{t("marketplaces.col.updated")}</span>
              <span>{t("marketplaces.col.actions")}</span>
            </div>
            {publications.map((publication) => {
              const hint = jsonHint(publication.last_error);
              return (
                <article key={publication.id}>
                  <div>
                    <Link href={`/manager/products/${publication.product_id}`}>
                      <strong>{publication.product_title}</strong>
                    </Link>
                    <small>
                      #{publication.product_id} · {publication.account.toUpperCase()}
                    </small>
                  </div>
                  <span>{marketplaceName[publication.marketplace]}</span>
                  <code>{publication.ean}</code>
                  <span className={`publication-status ${publication.status}`} title={hint || undefined}>
                    {t(`pub.${publication.status}` as MessageKey)}
                  </span>
                  <time dateTime={publication.updated_at}>{formatDate(publication.updated_at, true)}</time>
                  {listingActions(publication)}
                </article>
              );
            })}
          </div>
        )}
        <footer className="pagination">
          <button
            disabled={publicationPage <= 1 || loading}
            onClick={() => setPublicationPage((value) => value - 1)}
          >
            {t("common.previous")}
          </button>
          <span>{t("common.page", { page: publicationPage })}</span>
          <button disabled={!publicationCount || publicationPage * 20 >= publicationCount || loading} onClick={() => setPublicationPage((value) => value + 1)}>
            {t("common.next")}
          </button>
        </footer>
      </section>

      <section className="products-panel marketplace-jobs">
        <div className="marketplace-list-heading">
          <div>
            <p className="eyebrow">{t("marketplaces.jobsHistory")}</p>
            <h2>{t("marketplaces.jobsTitle")}</h2>
          </div>
          <div className="marketplace-filters">
            <select
              aria-label={t("marketplaces.filterOperation")}
              value={jobOperation}
              onChange={(event) => {
                setJobPage(1);
                setJobOperation(event.target.value);
              }}
            >
              <option value="">{t("marketplaces.allOperations")}</option>
              {operationKeys.map((value) => (
                <option key={value} value={value}>
                  {t(`job.op.${value}` as MessageKey)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("marketplaces.filterJobStatus")}
              value={jobStatus}
              onChange={(event) => {
                setJobPage(1);
                setJobStatus(event.target.value);
              }}
            >
              <option value="">{t("marketplaces.allJobStatuses")}</option>
              {jobStatusKeys.map((value) => (
                <option key={value} value={value}>
                  {t(`job.${value}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {jobs.length === 0 && !loading && <p className="products-message">{t("marketplaces.jobsEmpty")}</p>}
        {jobs.length > 0 && (
          <div className="job-table">
            <div className="job-header">
              <span>{t("marketplaces.col.product")}</span>
              <span>{t("marketplaces.col.operation")}</span>
              <span>{t("marketplaces.col.targets")}</span>
              <span>{t("marketplaces.col.status")}</span>
              <span>{t("marketplaces.col.started")}</span>
            </div>
            {jobs.map((job) => {
              const hint = jsonHint(job.error);
              return (
                <article key={job.id}>
                  <div>
                    <Link href={`/manager/products/${job.product_id}`}>
                      <strong>{job.product_title || `#${job.product_id}`}</strong>
                    </Link>
                    <small>#{job.product_id}</small>
                  </div>
                  <span>{t(`job.op.${job.operation}` as MessageKey)}</span>
                  <span>
                    {(job.requested_targets || []).map(targetKey).join(" · ") || job.requested_channels.join(", ")}
                  </span>
                  <span className={`job-status ${job.status}`} title={hint || undefined}>
                    {t(`job.${job.status}` as MessageKey)}
                  </span>
                  <time dateTime={job.created_at}>{formatDate(job.created_at, true)}</time>
                </article>
              );
            })}
          </div>
        )}
        <footer className="pagination">
          <button disabled={jobPage <= 1 || loading} onClick={() => setJobPage((value) => value - 1)}>
            {t("common.previous")}
          </button>
          <span>{t("common.page", { page: jobPage })}</span>
          <button disabled={!jobCount || jobPage * 20 >= jobCount || loading} onClick={() => setJobPage((value) => value + 1)}>
            {t("common.next")}
          </button>
        </footer>
      </section>
    </section>
  );
}
