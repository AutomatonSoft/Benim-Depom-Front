"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  Feedback,
  MetricCard,
  PageContainer,
  PageHeader,
  PaginationBar,
  StatusBadge,
} from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n, type MessageKey } from "@/i18n";

type Marketplace = "hood" | "otto" | "kaufland";
type Account = "jv" | "xl";
type Target = { marketplace: Marketplace; account: Account };

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

export function MarketplacesBoard({ initialQuery = "" }: { initialQuery?: string }) {
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
  const [marketplace, setMarketplace] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [jobOperation, setJobOperation] = useState("");
  const [search, setSearch] = useState(initialQuery);
  const [appliedSearch, setAppliedSearch] = useState(initialQuery);
  const [loading, setLoading] = useState(true);
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
      if (appliedSearch) {
        publicationParams.set("search", appliedSearch);
        jobParams.set("search", appliedSearch);
      }
      if (jobStatus) jobParams.set("status", jobStatus);
      if (jobOperation) jobParams.set("operation", jobOperation);

      try {
        const [
          publicationResponse,
          jobsResponse,
          inProgressResponse,
          activeResponse,
          failedResponse,
        ] = await Promise.all([
          authorizedFetch(`/api/v1/orchestrator/publications/?${publicationParams}`),
          authorizedFetch(`/api/v1/orchestrator/jobs/?${jobParams}`),
          authorizedFetch("/api/v1/orchestrator/jobs/?in_progress=true&page=1"),
          authorizedFetch("/api/v1/orchestrator/publications/?status=active&page=1"),
          authorizedFetch("/api/v1/orchestrator/publications/?status=failed&page=1"),
        ]);
        const responses = [publicationResponse, jobsResponse, inProgressResponse, activeResponse, failedResponse];
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
      } catch {
        setError(t("marketplaces.loadError"));
      } finally {
        silentReload.current = false;
        setLoading(false);
      }
    }

    void loadData();
  }, [marketplace, account, status, jobStatus, jobOperation, appliedSearch, publicationPage, jobPage, reloadKey, t]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      silentReload.current = true;
      setReloadKey((value) => value + 1);
    }, IN_FLIGHT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [shouldPoll]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublicationPage(1);
    setJobPage(1);
    setAppliedSearch(search.trim());
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

  function listingActions(publication: Publication) {
    const busy = listingBusyStatuses.has(publication.status) || Boolean(busyKey);
    const isBusy = (action: string) => busyKey === `${publication.id}:${action}`;
    if (listingBusyStatuses.has(publication.status)) {
      return <span className="text-xs font-bold text-muted-foreground">{t("marketplaces.waitingMarketplace")}</span>;
    }
    return (
      <div className="listing-actions">
        {publication.status === "active" && (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void runListingAction(publication, "update")}>
              {isBusy("update") ? t("marketplaces.queueing") : t("marketplaces.actionUpdate")}
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => void runListingAction(publication, "deactivate")}>
              {isBusy("deactivate")
                ? t("marketplaces.queueing")
                : publication.marketplace === "otto"
                  ? t("marketplaces.actionDeactivate")
                  : t("marketplaces.actionTakeDown")}
            </Button>
          </>
        )}
        {publication.status === "deactivated" && publication.marketplace === "otto" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void runListingAction(publication, "activate")}>
            {isBusy("activate") ? t("marketplaces.queueing") : t("marketplaces.actionActivate")}
          </Button>
        )}
        {(publication.status === "failed" || publication.status === "deleted") && (
          <Button size="sm" variant="accent" disabled={busy} onClick={() => void runListingAction(publication, "publish")}>
            {isBusy("publish") ? t("marketplaces.queueing") : t("marketplaces.actionRetry")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("common.panel")}
        title={t("marketplaces.title")}
        description={t("marketplaces.opsSubtitle")}
        secondaryActions={
          <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
            {shouldPoll ? t("marketplaces.autoRefresh") : t("common.refresh")}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("marketplaces.statJobs")} value={inProgressCount} hint={t("marketplaces.statJobsHint")} />
        <MetricCard label={t("marketplaces.statActive")} value={activeCount} hint={t("marketplaces.statActiveHint")} />
        <MetricCard tone={failedCount > 0 ? "danger" : "default"} label={t("marketplaces.statFailed")} value={failedCount} hint={t("marketplaces.statFailedHint")} />
        <MetricCard label={t("marketplaces.statListings")} value={publicationCount} hint={t("marketplaces.statListingsHint")} />
      </div>

      {error ? <Feedback className="mb-3">{error}</Feedback> : null}
      {notice ? <Feedback tone="success" className="mb-3">{notice}</Feedback> : null}

      {inProgressJobs.length > 0 ? (
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
                <StatusBadge status={job.status}>{t(`job.${job.status}` as MessageKey)}</StatusBadge>
                <time dateTime={job.created_at}>{formatDate(job.created_at, true)}</time>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <form className="marketplace-search" onSubmit={applySearch}>
        <label>
          {t("marketplaces.searchLabel")}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("marketplaces.searchPlaceholder")}
            aria-label={t("marketplaces.searchLabel")}
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
            <FilterSelect
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
            </FilterSelect>
            <FilterSelect
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
            </FilterSelect>
            <FilterSelect
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
            </FilterSelect>
          </div>
        </div>

        <PaginationBar
          page={publicationPage}
          hasPrevious={publicationPage > 1}
          hasNext={Boolean(publicationCount) && publicationPage * 20 < publicationCount}
          loading={loading}
          onPrevious={() => setPublicationPage((value) => value - 1)}
          onNext={() => setPublicationPage((value) => value + 1)}
          previousLabel={t("common.previous")}
          nextLabel={t("common.next")}
          pageLabel={t("common.page", { page: publicationPage })}
        />

        {loading && publications.length === 0 ? (
          <div className="grid gap-3 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-2/3" />
          </div>
        ) : null}
        {!loading && publications.length === 0 ? (
          <p className="products-message">{t("marketplaces.empty")}</p>
        ) : null}
        {publications.length > 0 ? (
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
                    <Link className="listing-open-marketplaces" href={`/manager/products/${publication.product_id}/listings`}>
                      {t("listing.openPage")}
                    </Link>
                  </div>
                  <span>{marketplaceName[publication.marketplace]}</span>
                  <code>{publication.ean || "—"}</code>
                  <span title={hint || undefined}>
                    <StatusBadge status={publication.status}>{t(`pub.${publication.status}` as MessageKey)}</StatusBadge>
                  </span>
                  <time dateTime={publication.updated_at}>{formatDate(publication.updated_at, true)}</time>
                  {listingActions(publication)}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="products-panel marketplace-jobs">
        <div className="marketplace-list-heading">
          <div>
            <p className="eyebrow">{t("marketplaces.jobsHistory")}</p>
            <h2>{t("marketplaces.jobsTitle")}</h2>
          </div>
          <div className="marketplace-filters">
            <FilterSelect
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
            </FilterSelect>
            <FilterSelect
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
            </FilterSelect>
          </div>
        </div>

        <PaginationBar
          page={jobPage}
          hasPrevious={jobPage > 1}
          hasNext={Boolean(jobCount) && jobPage * 20 < jobCount}
          loading={loading}
          onPrevious={() => setJobPage((value) => value - 1)}
          onNext={() => setJobPage((value) => value + 1)}
          previousLabel={t("common.previous")}
          nextLabel={t("common.next")}
          pageLabel={t("common.page", { page: jobPage })}
        />

        {jobs.length === 0 && !loading ? <p className="products-message">{t("marketplaces.jobsEmpty")}</p> : null}
        {jobs.length > 0 ? (
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
                  <span title={hint || undefined}>
                    <StatusBadge status={job.status}>{t(`job.${job.status}` as MessageKey)}</StatusBadge>
                  </span>
                  <time dateTime={job.created_at}>{formatDate(job.created_at, true)}</time>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
}
