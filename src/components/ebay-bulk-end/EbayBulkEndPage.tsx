"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Clock3,
  CircleHelp,
  Download,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  X,
  RefreshCw,
} from "lucide-react";

import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { setSessionItem } from "@/lib/browser-storage";
import { useI18n } from "@/i18n";
import { managerAccessStateForStatus } from "./ebayBulkEndAccess";
import { Button } from "@/components/ui/button";

import styles from "./EbayBulkEndPage.module.css";
import { eanIsValid, parseEanTokens, parseEans } from "./ebayBulkEndEans";
import { ebayBulkEndMessages, interpolateEbayBulkEnd } from "./messages";

type AccountName = "jv" | "xl" | "depotum";

type Account = {
  account: AccountName;
  connected: boolean;
  access_token_valid: boolean;
  refresh_token_valid: boolean;
  updated_at: string | null;
};

type Match = {
  item_id: string;
  title: string;
  sku: string;
  match_type: string;
  identifier_conflict?: boolean;
  seller_id: string;
  listing_status: string;
  listing_type: string;
  bid_count: number | null;
  auction_risky: boolean;
  view_url: string;
  matches: Array<{
    ean: string;
    type: "listing" | "variation";
    variation?: string;
    source?: string;
    match_type?: string;
    sku?: string;
    identifier_conflict?: boolean;
  }>;
  risky: boolean;
  variation_count: number;
  managed_by_benim?: boolean;
};

type Result = {
  item_id: string;
  title: string;
  eans: string[];
  status: string;
  message: string;
  error_code?: string;
  end_time?: string;
  finished_at?: string;
};

type Job = {
  job_id: string;
  kind: "scan" | "end";
  account: AccountName;
  environment: "sandbox" | "production";
  status: string;
  progress: { stage?: string; current: number; total: number | null };
  message: string;
  cancel_requested?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  finished_at?: string | null;
  summary?: JobSummary;
  preview_expires_at?: string | null;
  unmatched_eans: string[];
  unmatched_status_by_ean?: Record<string, string>;
  matches: Match[];
  results: Result[];
  report_rows?: Result[];
  discovery_complete?: boolean;
  discovery_strategy?: string;
  discovery_details?: { ean_search_complete?: boolean; sku_search_complete?: boolean; report_request_unconfirmed?: boolean };
};

type Connections = {
  environment: "sandbox" | "production";
  accounts: Account[];
  max_eans_per_scan: number;
};

type ApiPayload = Record<string, unknown>;
type JobSummary = {
  listing_count: number;
  matched_ean_count: number;
  eligible_count: number;
  risky_count: number;
  submitted_ean_count?: number;
  ended_item_count?: number;
  failed_item_count?: number;
  not_found_ean_count?: number;
  uncertain_item_count?: number;
  not_selected_item_count?: number;
  ended_ean_count?: number;
  managed_listing_count?: number;
};

const apiRoot = "/api/v2/ebay-bulk-end";
const JOB_STORAGE_KEY = "ebay-bulk-end:job";
const activeStatuses = new Set(["queued", "scanning", "ending"]);

function statusLabel(status: string, labels: Record<string, string>) {
  return labels[status] ?? status;
}

function apiMessage(payload: ApiPayload, fallback: string) {
  return apiErrorMessage(payload, fallback);
}

export default function EbayBulkEndPage() {
  const { locale } = useI18n();
  const copy = ebayBulkEndMessages[locale];
  const [authState, setAuthState] = useState<"checking" | "guest" | "manager" | "denied" | "error">("checking");
  const [connections, setConnections] = useState<Connections | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [authorizingAccount, setAuthorizingAccount] = useState<AccountName | "">("");
  const [account, setAccount] = useState<AccountName | "">("");
  const [eanInput, setEanInput] = useState("");
  const [eanTouched, setEanTouched] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includeVariations, setIncludeVariations] = useState(false);
  const [includeAuctionRisk, setIncludeAuctionRisk] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const rawEans = useMemo(() => parseEanTokens(eanInput), [eanInput]);
  const eans = useMemo(() => parseEans(eanInput), [eanInput]);
  const badEans = useMemo(() => eans.filter((ean) => !eanIsValid(ean)), [eans]);
  const duplicateEanCount = rawEans.length - eans.length;
  const connectedAccount = connections?.accounts.find((row) => row.account === account);
  const maxEansPerScan = connections?.max_eans_per_scan ?? 500;
  const previewExpired = job?.status === "expired";

  const rejectAccess = useCallback((status: number) => {
    const nextState = managerAccessStateForStatus(status);
    if (nextState !== "guest" && nextState !== "denied") return false;
    setAuthState(nextState);
    setConnections(null);
    setJob(null);
    setJobId("");
    setSelectedIds([]);
    // Retain the opaque job ID so its owner can recover it after signing in again.
    return true;
  }, []);

  async function loadConnections() {
    try {
      const response = await authorizedFetch(apiRoot + "/connections/");
      const accessState = managerAccessStateForStatus(response.status);
      if (accessState === "guest" || accessState === "denied") {
        rejectAccess(response.status);
        return;
      }
      if (accessState === "error") {
        const payload = (await response.json().catch(() => ({}))) as ApiPayload;
        setConnectionError(apiMessage(payload, copy.errors.connectionCheck));
        setConnections(null);
        setAuthState("error");
        return;
      }
      const data = (await response.json()) as Connections;
      setConnections(data);
      setConnectionError("");
      setAuthState("manager");
    } catch {
      setConnectionError(copy.errors.server);
      setConnections(null);
      setAuthState("error");
    }
  }

  async function authorizeAccount(target: AccountName) {
    if (job && activeStatuses.has(job.status)) return;
    setConnectionError("");
    setAuthorizingAccount(target);
    try {
      const response = await authorizedFetch("/api/v1/ebay/oauth/start/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: target }),
      });
      if (rejectAccess(response.status)) return;
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok || typeof payload.authorization_url !== "string") {
        setConnectionError(apiMessage(payload, copy.errors.authorization));
        return;
      }
      if (!connections || payload.environment !== connections.environment) {
        setConnectionError(copy.errors.authorization);
        return;
      }
      const authorizationUrl = new URL(payload.authorization_url);
      const expectedAuthHost =
        connections.environment === "sandbox" ? "auth.sandbox.ebay.com" : "auth.ebay.com";
      if (
        authorizationUrl.protocol !== "https:" ||
        authorizationUrl.hostname !== expectedAuthHost
      ) {
        setConnectionError(copy.errors.authorization);
        return;
      }
      window.location.assign(authorizationUrl.href);
    } catch {
      setConnectionError(copy.errors.authorization);
    } finally {
      setAuthorizingAccount("");
    }
  }

  useEffect(() => {
    let live = true;
    async function checkSession() {
      try {
        const response = await authorizedFetch(apiRoot + "/connections/");
        if (!live) return;
        const accessState = managerAccessStateForStatus(response.status);
        if (accessState === "guest" || accessState === "denied") {
          rejectAccess(response.status);
        } else if (accessState === "error") {
          const payload = (await response.json().catch(() => ({}))) as ApiPayload;
          setConnectionError(apiMessage(payload, copy.errors.connectionCheck));
          setConnections(null);
          setAuthState("error");
        } else {
          setConnections((await response.json()) as Connections);
          try {
            const savedJobId = window.sessionStorage.getItem(JOB_STORAGE_KEY);
            if (savedJobId) setJobId(savedJobId);
          } catch {
            // Job recovery is optional when browser storage is unavailable.
          }
          setAuthState("manager");
        }
      } catch {
        if (!live) return;
        setConnectionError(copy.errors.server);
        setConnections(null);
        setAuthState("error");
      }
    }
    void checkSession();
    return () => {
      live = false;
    };
  }, [rejectAccess, locale, copy.errors.connectionCheck, copy.errors.server]);

  const currentJobStatus = job?.status;
  useEffect(() => {
    if (authState !== "manager" || !jobId || (currentJobStatus && !activeStatuses.has(currentJobStatus))) return;
    let cancelled = false;
    let timer: number | undefined;
    async function poll() {
      try {
        const response = await authorizedFetch(apiRoot + "/jobs/" + jobId + "/");
        if (cancelled) return;
        if (rejectAccess(response.status)) return;
        const payload = (await response.json().catch(() => ({}))) as ApiPayload;
        if (!response.ok) {
          setActionError(apiMessage(payload, copy.errors.jobRefresh));
          if (!cancelled && (response.status === 429 || response.status >= 500)) {
            timer = window.setTimeout(poll, 5000);
          }
          return;
        }
        const next = payload as unknown as Job;
        setJob(next);
        if (next.status === "preview") {
          setSelectedIds(next.matches.filter((match) => !match.risky && !match.auction_risky && !match.managed_by_benim && !match.identifier_conflict).map((match) => match.item_id));
        }
        if (!cancelled && activeStatuses.has(next.status)) {
          timer = window.setTimeout(poll, 1800);
        }
      } catch {
        if (!cancelled) {
          setActionError(copy.errors.interrupted);
          timer = window.setTimeout(poll, 3500);
        }
      }
    }
    timer = window.setTimeout(poll, 500);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [authState, rejectAccess, jobId, currentJobStatus, locale, copy.errors.interrupted, copy.errors.jobRefresh]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const response = await fetch("/portal-auth/manager/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setLoginError(response.status === 401 ? copy.errors.credentials : copy.errors.login);
        return;
      }
      const tokens = (await response.json()) as { access?: string };
      if (!tokens.access) {
        setLoginError(copy.errors.token);
        return;
      }
      const profileResponse = await fetch("/api/v2/auth/me/", {
        credentials: "same-origin",
        headers: { Authorization: "Bearer " + tokens.access },
      });
      if (!profileResponse.ok) {
        setLoginError(copy.errors.permissions);
        return;
      }
      const profile = (await profileResponse.json()) as { role?: string };
      if (profile.role !== "manager" && profile.role !== "admin") {
        setLoginError(copy.errors.managersOnly);
        return;
      }
      setSessionItem(window.localStorage, "benim_access_token", tokens.access);
      window.localStorage.removeItem("benim_refresh_token");
      setPassword("");
      try {
        const savedJobId = window.sessionStorage.getItem(JOB_STORAGE_KEY);
        if (savedJobId) setJobId(savedJobId);
      } catch {
        // Job recovery is optional when browser storage is unavailable.
      }
      await loadConnections();
    } catch {
      setLoginError(copy.errors.server);
    } finally {
      setLoginLoading(false);
    }
  }

  async function startScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEanTouched(true);
    setActionError("");
    if (job && activeStatuses.has(job.status)) {
      setActionError(copy.errors.wait);
      return;
    }
    if (!account) {
      setActionError(copy.errors.chooseAccount);
      return;
    }
    if (!connections) {
      setActionError(copy.errors.connectionCheck);
      return;
    }
    if (eans.length === 0 || badEans.length > 0) {
      setActionError(copy.errors.invalidEan);
      return;
    }
    if (rawEans.length > maxEansPerScan) {
      setActionError(interpolateEbayBulkEnd(copy.errors.eanLimit, { limit: maxEansPerScan }));
      return;
    }
    if (!connectedAccount?.connected || !connectedAccount.refresh_token_valid) {
      setActionError(copy.errors.disconnected);
      return;
    }
    setBusy(true);
    setJob(null);
    setJobId("");
    try {
      window.sessionStorage.removeItem(JOB_STORAGE_KEY);
    } catch {
      // The server job is still available until its seven-day expiry.
    }
    setSelectedIds([]);
    setIncludeVariations(false);
    setIncludeAuctionRisk(false);
    try {
      const response = await authorizedFetch(apiRoot + "/scans/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, eans }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (rejectAccess(response.status)) return;
      if (!response.ok) {
        setActionError(apiMessage(payload, copy.errors.scan));
        return;
      }
      const accepted = payload as { job_id: string; status: string };
      setJobId(accepted.job_id);
      try {
        window.sessionStorage.setItem(JOB_STORAGE_KEY, accepted.job_id);
      } catch {
        // Keep the current job visible even when browser storage is unavailable.
      }
      setJob({
        job_id: accepted.job_id,
        kind: "scan",
        account,
        environment: connections.environment,
        status: accepted.status,
        progress: { current: 0, total: null },
        message: "",
        unmatched_eans: [],
        matches: [],
        results: [],
      });
    } catch {
      setActionError(copy.errors.server);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnd() {
    if (busy) return;
    setActionError("");
    if (!job || selectedIds.length === 0) {
      setActionError(copy.errors.selectListing);
      return;
    }
    const hasRiskySelection = job.matches.some(
      (match) => selectedIds.includes(match.item_id) && match.risky,
    );
    if (hasRiskySelection && !includeVariations) {
      setActionError(copy.errors.variationConsent);
      return;
    }
    const hasAuctionRiskSelection = selectedMatches.some((match) => match.auction_risky);
    if (hasAuctionRiskSelection && !includeAuctionRisk) {
      setActionError(copy.errors.auctionConsent);
      return;
    }
    setBusy(true);
    try {
      const response = await authorizedFetch(apiRoot + "/jobs/" + job.job_id + "/confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_ids: selectedIds,
          typed_account: job.account.toUpperCase(),
          include_variations: includeVariations,
          include_auction_risk: includeAuctionRisk,
          confirm_unavailable_reason: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (rejectAccess(response.status)) return;
      if (!response.ok) {
        setActionError(apiMessage(payload, copy.errors.confirm));
        if (response.status === 410) {
          setJob((current) => current ? { ...current, status: "expired", matches: [] } : current);
        }
        return;
      }
      setJob((current) =>
        current ? { ...current, kind: "end", status: "ending", progress: { current: 0, total: selectedIds.length } } : current,
      );
    } catch {
      setActionError(copy.errors.server);
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnd() {
    if (!job || cancelBusy) return;
    setCancelBusy(true);
    setActionError("");
    try {
      const response = await authorizedFetch(apiRoot + "/jobs/" + job.job_id + "/cancel/", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (rejectAccess(response.status)) return;
      if (!response.ok) {
        setActionError(apiMessage(payload, copy.errors.cancel));
        return;
      }
      setJob((current) => current ? {
        ...current,
        cancel_requested: true,
        message: copy.stopCurrentBatchMessage,
      } : current);
    } catch {
      setActionError(copy.errors.server);
    } finally {
      setCancelBusy(false);
    }
  }

  async function downloadReport() {
    if (!job) return;
    setActionError("");
    try {
      const response = await authorizedFetch(apiRoot + "/jobs/" + job.job_id + "/csv/");
      if (rejectAccess(response.status)) return;
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiPayload;
        setActionError(apiMessage(payload, copy.errors.report));
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "ebay-bulk-end-" + job.job_id + ".csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setActionError(copy.errors.report);
    }
  }

  function toggleSelected(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((value) => value !== itemId) : [...current, itemId],
    );
  }

  if (authState === "checking") {
    return (
      <main className={styles.page} aria-busy="true">
        <span className={styles.visuallyHidden} role="status">{copy.checkingManager}</span>
        <header className={styles.topbar}>
          <span className={styles.wordmark}><span>Benim</span><span className={styles.wordmarkAccent}>Depom</span></span>
          <span className={styles.topbarLabel}>eBay</span>
        </header>
        <div className={styles.frame}>
          <div className={styles.loadingHeading} />
          <div className={styles.loadingText} />
          <div className={styles.workspace}>
            <div className={styles.loadingPanel}>
              <div className={styles.loadingLine} />
              <div className={styles.loadingField} />
              <div className={styles.loadingField} />
              <div className={styles.loadingButton} />
            </div>
            <div className={styles.loadingPanel}>
              <div className={styles.loadingLine} />
              <div className={styles.loadingText} />
              <div className={styles.loadingTextShort} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (authState === "guest") {
    return (
      <main className={styles.page}>
        <header className={styles.topbar}>
          <Link className={styles.wordmark} href="/"><span>Benim</span><span className={styles.wordmarkAccent}>Depom</span></Link>
          <span className={styles.topbarLabel}>{copy.ebayTool}</span>
        </header>
        <section className={styles.loginCard} aria-labelledby="login-title">
          <div className={styles.loginIcon}><LockKeyhole aria-hidden /></div>
          <h1 id="login-title">{copy.managerLogin}</h1>
          <p>{copy.loginPrompt}</p>
          <form onSubmit={submitLogin} className={styles.formStack}>
            <label className={styles.field}>
              <span>{copy.email}</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>{copy.password}</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {loginError ? <p className={styles.errorText} role="alert">{loginError}</p> : null}
            <button className={styles.primaryButton} disabled={loginLoading} type="submit">
              {loginLoading ? <LoaderCircle aria-hidden className={styles.spin} /> : <ShieldCheck aria-hidden />}
              {loginLoading ? copy.loggingIn : copy.login}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (authState === "denied") {
    return (
      <main className={styles.page}>
        <section className={styles.messageCard} role="alert">
          <ShieldCheck aria-hidden />
          <h1>{copy.noAccess}</h1>
          <p>{copy.managersOnly}</p>
        </section>
      </main>
    );
  }

  if (authState === "error") {
    return (
      <main className={styles.page}>
        <header className={styles.topbar}>
          <Link className={styles.wordmark} href="/"><span>Benim</span><span className={styles.wordmarkAccent}>Depom</span></Link>
          <span className={styles.topbarLabel}>{copy.ebayTool}</span>
        </header>
        <section className={styles.messageCard} role="alert">
          <AlertTriangle aria-hidden />
          <h1>{copy.errors.connectionCheck}</h1>
          <p>{connectionError || copy.errors.server}</p>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setConnectionError("");
              setAuthState("checking");
              void loadConnections();
            }}
          >
            {copy.refresh}
          </button>
        </section>
      </main>
    );
  }

  const jobIsPreview = job?.kind === "scan" && (job.status === "preview" || job.status === "expired");
  const jobIsWorking = Boolean(job && activeStatuses.has(job.status));
  const jobIsFinished = job?.kind === "end" && !jobIsWorking;
  const progressPercent = job?.progress.total
    ? Math.min(100, Math.round((job.progress.current / job.progress.total) * 100))
    : 0;
  const progressStages: Record<string, string> = {
    requesting_report: copy.progressRequestReport,
    recovering_report_request: copy.progressRecoverReport,
    retrying_report: copy.progressRetryReport,
    waiting_report_quota: copy.progressReportQuota,
    waiting_for_report: copy.progressWaitingReport,
    downloading_report: copy.progressDownloadReport,
    importing_report: copy.progressImportReport,
    verifying_report: copy.progressVerifyReport,
    verifying_candidates: copy.progressVerifyCandidates,
    indexing_identifiers: copy.progressIndexIdentifiers,
    searching_identifiers: copy.progressSearchIdentifiers,
  };
  const progressStage = progressStages[job?.progress.stage ?? ""] ?? copy.progressPreparing;
  const recoveringReport = job?.progress.stage === "recovering_report_request";
  const jobMessage = jobIsWorking && job?.kind === "scan"
    ? (recoveringReport ? copy.progressRecoverReportDetails : null)
    : job?.discovery_details?.report_request_unconfirmed ? copy.reportRecoveryFailed : job?.message;
  const selectedMatches = job?.matches.filter((match) => selectedIds.includes(match.item_id)) ?? [];
  const unverifiedEans = job?.unmatched_eans.filter((ean) => job.unmatched_status_by_ean?.[ean] === "verification_failed") ?? [];
  const notIndexedEans = job?.unmatched_eans.filter((ean) => job.unmatched_status_by_ean?.[ean] !== "verification_failed") ?? [];
  const selectedEanCount = new Set(selectedMatches.flatMap((match) => match.matches.map((value) => value.ean))).size;
  const listingIdsByEan = new Map<string, Set<string>>();
  for (const listing of job?.matches ?? []) {
    for (const { ean } of listing.matches) {
      const ids = listingIdsByEan.get(ean) ?? new Set<string>();
      ids.add(listing.item_id);
      listingIdsByEan.set(ean, ids);
    }
  }
  const repeatedEans = [...listingIdsByEan].filter(([, ids]) => ids.size > 1);
  const eligibleMatches = job?.matches.filter((match) => !match.risky && !match.auction_risky && !match.managed_by_benim && !match.identifier_conflict) ?? [];
  const eligibleEanCount = new Set(eligibleMatches.flatMap((match) => match.matches.map((value) => value.ean))).size;
  const managedMatchCount = job?.summary?.managed_listing_count ?? job?.matches.filter((match) => match.managed_by_benim).length ?? 0;
  const canStartScan = Boolean(
    account && connectedAccount?.connected && connectedAccount.refresh_token_valid && connections,
  );
  const reportDateFormatter = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "medium", timeStyle: "medium",
  });

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.wordmark} href="/"><span>Benim</span><span className={styles.wordmarkAccent}>Depom</span></Link>
        <div className={styles.topbarRight}>
          {connections ? (
            <span className={connections.environment === "production" ? styles.environmentProduction : styles.environmentSandbox}>
              {connections.environment === "production" ? "Production" : "Sandbox"}
            </span>
          ) : null}
          <span className={styles.topbarLabel}>eBay</span>
          <Link className={styles.historyLink} href="/ebay/history">{copy.historyNav}</Link>
        </div>
      </header>

      <div className={styles.frame}>
        <section className={styles.intro}>
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className={styles.safetyMark}><ShieldCheck aria-hidden /><span>{copy.safety}</span></div>
        </section>

        {connectionError ? <p className={styles.errorBanner} role="alert">{connectionError}</p> : null}
        <div className={styles.workspace}>
          <section className={styles.searchPanel}>
            <form onSubmit={startScan} noValidate>
              <div className={styles.accountHeading}>
                <div className={styles.sectionHeading}>
                  <span className={styles.stepNumber}>1</span>
                  <div><h2 id="ebay-account-heading">{copy.account}</h2><p>{copy.chooseAccount}</p></div>
                </div>
                <Button
                  className={styles.refreshButton}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadConnections()}
                  aria-label={copy.refresh}
                >
                  <RefreshCw aria-hidden /> {copy.refresh}
                </Button>
              </div>
              <fieldset className={styles.accountFieldset} aria-labelledby="ebay-account-heading">
                <legend className={styles.visuallyHidden}>{copy.account}</legend>
                <div className={styles.accountGrid}>
                  {connections?.accounts.map((row) => {
                    const connected = row.connected && row.refresh_token_valid;
                    return (
                      <div
                        className={`${styles.accountCard} ${account === row.account ? styles.accountCardSelected : ""}`}
                        key={row.account}
                      >
                        <label className={styles.accountChoice} htmlFor={`ebay-account-${row.account}`}>
                          <input
                            className={styles.accountRadio}
                            id={`ebay-account-${row.account}`}
                            name="ebay-account"
                            type="radio"
                            value={row.account}
                            checked={account === row.account}
                            required
                            disabled={jobIsWorking}
                            onChange={() => setAccount(row.account)}
                          />
                          <span className={styles.accountRadioMark} aria-hidden="true" />
                          <span className={styles.accountName}>{row.account.toUpperCase()}</span>
                        </label>
                        <span className={styles.accountState}>
                          {connected
                            ? <Check aria-hidden className={styles.connectionIconOn} />
                            : <AlertTriangle aria-hidden className={styles.connectionIconOff} />}
                          {!row.connected ? copy.missingToken : row.refresh_token_valid ? copy.savedToken : copy.reconnect}
                        </span>
                        <Button
                          className={styles.accountAuthButton}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(authorizingAccount) || jobIsWorking}
                          onClick={() => void authorizeAccount(row.account)}
                        >
                          {authorizingAccount === row.account
                            ? copy.authorizing
                            : connected ? copy.reauthorizeAccount : copy.authorizeAccount}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              <p className={styles.accountNote}>{copy.accessCheck}</p>

              <div className={styles.sectionHeading}>
                <span className={styles.stepNumber}>2</span>
                <div><h2>{copy.eanList}</h2><p>{copy.eanHint}</p></div>
              </div>
              <label className={styles.field}>
                <span className={styles.eanLabel}>EAN <span className={styles.required}>{copy.required}</span></span>
                <textarea
                  className={styles.eanInput}
                  value={eanInput}
                  onChange={(event) => setEanInput(event.target.value)}
                  onBlur={() => setEanTouched(true)}
                  rows={6}
                  maxLength={8000}
                  placeholder={"4006381333931\n01234565"}
                  aria-invalid={eanTouched && badEans.length > 0}
                  aria-describedby="ean-help"
                  required
                />
                <span id="ean-help" className={eanTouched && badEans.length ? styles.errorText : styles.fieldHint}>
                  {eanTouched && badEans.length
                    ? copy.eanInvalidPrefix + badEans.slice(0, 3).join(", ")
                    : interpolateEbayBulkEnd(copy.eanCount, { raw: rawEans.length, valid: eans.length - badEans.length, duplicates: duplicateEanCount, limit: maxEansPerScan })}
                </span>
              </label>
              {account && !canStartScan ? (
                <p className={styles.warningBanner}><AlertTriangle aria-hidden /> {copy.accountReconnect}</p>
              ) : null}
              <button className={`${styles.primaryButton} ${styles.scanButton}`} disabled={busy || !canStartScan} type="submit">
                {busy ? <LoaderCircle aria-hidden className={styles.spin} /> : <Search aria-hidden />}
                {busy ? copy.starting : copy.findListings}
              </button>
            </form>
          </section>

          <section className={styles.guidancePanel} aria-label={copy.guidanceAria}>
            <div className={styles.guidanceIcon}><CircleHelp aria-hidden /></div>
            <h2>{copy.beforeEnding}</h2>
            <ul>
              <li>{copy.exactEan}</li>
              <li>{copy.noTitleOrSku}</li>
              <li>{copy.auctionWarning}</li>
              <li>{copy.previewFirst}</li>
            </ul>
          </section>
        </div>

        {actionError ? <p className={styles.errorBanner} role="alert"><X aria-hidden /> {actionError}</p> : null}

        {job ? (
          <section className={styles.jobPanel} aria-live="polite">
            <div className={styles.jobHeader}>
              <div>
                <p className={styles.jobKicker}>{job.account.toUpperCase()}, {job.environment === "production" ? "Production" : "Sandbox"}</p>
                <h2>
                  {job.status === "scanning" || job.status === "queued"
                    ? copy.scanningHeading
                    : job.status === "ending"
                      ? copy.endingHeading
                      : job.status === "preview"
                        ? copy.previewHeading
                        : job.status === "incomplete"
                          ? copy.incompleteHeading
                          : jobIsFinished
                            ? copy.reportHeading
                            : copy.jobHeading}
                </h2>
              </div>
              <span className={job.status === "incomplete" || job.status === "uncertain" ? styles.statusWarning : styles.statusNeutral}>
                {statusLabel(job.status, copy.status)}
              </span>
            </div>

            {jobIsWorking ? (
              <div className={styles.progressBlock}>
                <div
                  className={`${styles.progressTrack} ${job.progress.total == null ? styles.progressIndeterminate : ""}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={job.progress.total ?? undefined}
                  aria-valuenow={job.progress.total == null ? undefined : job.progress.current}
                  aria-valuetext={job.progress.total == null ? progressStage : undefined}
                >
                  <span style={job.progress.total == null ? undefined : { width: progressPercent + "%" }} />
                </div>
                <p>{job.progress.total != null
                  ? interpolateEbayBulkEnd(copy.progressOf, { current: job.progress.current, total: job.progress.total }) + " " + (job.progress.stage === "searching_identifiers" ? copy.searchRequests : copy.listings)
                  : progressStage}</p>
              </div>
            ) : null}

            {jobMessage ? <p className={recoveringReport || job.status === "incomplete" || job.status === "uncertain" ? styles.warningBanner : styles.infoBanner}>{jobMessage}</p> : null}
            <p className={styles.jobReference}>{copy.taskReference}: {job.job_id}</p>

            {job.status === "ending" && !job.cancel_requested ? (
              <button className={styles.secondaryButton} type="button" disabled={cancelBusy} onClick={() => void cancelEnd()}>
                {cancelBusy ? <LoaderCircle aria-hidden className={styles.spin} /> : <X aria-hidden />}
                {copy.stopAfterBatch}
              </button>
            ) : null}
            {job.cancel_requested ? <p className={styles.warningBanner}>{copy.cancelRequested}</p> : null}

            {jobIsPreview && !previewExpired ? (
              <div className={styles.preview}>
                <div className={styles.previewSummary}>
                  <div><span>{copy.previewFound}</span><strong>{job.matches.length}</strong><small>{interpolateEbayBulkEnd(copy.previewEanCoverage, { matched: listingIdsByEan.size, total: job.summary?.submitted_ean_count ?? listingIdsByEan.size + job.unmatched_eans.length })}</small></div>
                  <div><span>{copy.previewEligible}</span><strong>{eligibleMatches.length}</strong><small>{eligibleEanCount} EAN · {copy.previewEligibleHint}</small></div>
                  <div><span><LockKeyhole aria-hidden /> BENIM DEPOM</span><strong>{managedMatchCount}</strong><small>{copy.previewProtectedHint}</small></div>
                  <div className={styles.selectedStat}><span>{copy.previewSelected}</span><strong>{selectedIds.length}</strong><small>{selectedEanCount} EAN</small></div>
                </div>
                <p className={styles.previewExpiry}><Clock3 aria-hidden />{interpolateEbayBulkEnd(copy.previewExpires, {
                    time: job.preview_expires_at ? new Date(job.preview_expires_at).toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit" }) : copy.fifteenMinutes,
                  })}</p>
                {unverifiedEans.length ? <p className={styles.warningBanner}><AlertTriangle aria-hidden />{copy.verificationFailed} {unverifiedEans.join(", ")}</p> : null}
                {notIndexedEans.length ? <p className={styles.infoBanner}>{copy.coverageWarning} {notIndexedEans.join(", ")}</p> : null}
                {repeatedEans.length ? <p className={styles.infoBanner}>{copy.previewRepeatedEans} {repeatedEans.map(([ean, ids]) => `${ean} (${ids.size})`).join(", ")}</p> : null}
                {job.matches.length ? (
                  <>
                    <div className={styles.tableTools}>
                      <span>{copy.previewSelectionHint}</span>
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        onClick={() => setSelectedIds(job.matches.filter((match) => !match.managed_by_benim && !match.identifier_conflict && (!match.risky || includeVariations) && (!match.auction_risky || includeAuctionRisk)).map((match) => match.item_id))}
                      >
                        <Check aria-hidden />{copy.selectAvailable}
                      </button>
                    </div>
                    <div className={styles.tableFrame}>
                      <table className={`${styles.resultsTable} ${styles.previewTable}`}>
                        <thead><tr><th scope="col">{copy.selectLabel}</th><th scope="col">{copy.listing}</th><th scope="col">{copy.matchedEans}</th><th scope="col">{copy.previewCheck}</th></tr></thead>
                        <tbody>
                          {job.matches.map((match) => (
                            <tr key={match.item_id} data-selected={selectedIds.includes(match.item_id)} data-protected={Boolean(match.managed_by_benim)}>
                              <td data-label={copy.selectLabel}>
                                <label className={styles.rowSelection}>
                                  <input
                                    type="checkbox"
                                    aria-label={copy.selectItem + match.item_id}
                                    checked={selectedIds.includes(match.item_id)}
                                    disabled={Boolean(match.managed_by_benim || match.identifier_conflict) || (match.risky && !includeVariations) || (match.auction_risky && !includeAuctionRisk)}
                                    onChange={() => toggleSelected(match.item_id)}
                                  />
                                </label>
                              </td>
                              <td data-label={copy.listing}>
                                <strong className={styles.itemTitle}>{match.title || copy.untitled}</strong>
                                <span className={styles.itemId}>ItemID {match.item_id}</span>
                                {match.sku ? <span className={styles.itemId}>{copy.skuLabel}{match.sku}</span> : null}
                                <span className={styles.itemId}>{copy.matchType}{match.match_type?.includes("mpn") ? (match.match_type.includes("variation") ? copy.labelExactVariationMpn : copy.labelExactMpn) : match.match_type?.includes("variation") ? match.match_type.includes("sku") ? copy.labelExactVariationSku : copy.labelExactVariationEan : match.match_type?.includes("sku") ? copy.labelExactSku : copy.labelExactEan}</span>
                                <span className={styles.itemId}>{copy.seller}{match.seller_id || copy.sellerUnknown}</span>
                                <span className={styles.itemId}>{job.account.toUpperCase()} · {match.listing_status || copy.eBayActive}{match.variation_count ? ` · ${copy.variations}: ${match.variation_count}` : ""}</span>
                                {match.view_url ? <a className={styles.itemLink} href={match.view_url} target="_blank" rel="noreferrer">{copy.openEbay}</a> : null}
                              </td>
                              <td data-label={copy.matchedEans}>
                                <div className={styles.eanTags}>
                                  {match.matches.map((value) => (
                                    <span className={value.type === "variation" ? styles.eanRisk : styles.eanTag} key={value.ean}>
                                      {value.ean}{value.type === "variation" ? copy.variation + (value.variation ? ": " + value.variation : "") : ""}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td data-label={copy.previewCheck}>
                                {match.identifier_conflict ? (
                                  <div className={styles.eanTags}><span className={styles.eanRisk}><AlertTriangle aria-hidden />{copy.identifierConflict}</span></div>
                                ) : match.managed_by_benim ? (
                                  <div className={styles.eanTags}>
                                    <span className={styles.managedBadge} title={copy.managedListing}><LockKeyhole aria-hidden /> {copy.previewProtected}</span>
                                    <span className={styles.protectionNote}>{copy.previewProtectedHint}</span>
                                  </div>
                                ) : match.risky || match.auction_risky ? (
                                  <div className={styles.eanTags}>
                                    {match.risky ? <span className={styles.riskBadge}><AlertTriangle aria-hidden /> {copy.hasVariations}</span> : null}
                                    {match.auction_risky ? <span className={styles.riskBadge}><AlertTriangle aria-hidden /> {copy.auctionRisk} · {copy.bidCount}: {match.bid_count ?? "—"}</span> : null}
                                  </div>
                                ) : <span className={styles.safeBadge}><Check aria-hidden /> {copy.exactMatch}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {job.matches.some((match) => match.risky) ? (
                      <label className={styles.riskOptIn}>
                        <input
                          type="checkbox"
                          checked={includeVariations}
                          onChange={(event) => setIncludeVariations(event.target.checked)}
                        />
                        <span>{copy.variationConsentText}</span>
                      </label>
                    ) : null}
                    {job.matches.some((match) => match.auction_risky) ? (
                      <label className={styles.riskOptIn}>
                        <input type="checkbox" checked={includeAuctionRisk} onChange={(event) => setIncludeAuctionRisk(event.target.checked)} />
                        <span>{copy.auctionConsentText}</span>
                      </label>
                    ) : null}
                    <div className={styles.confirmRow}>
                      <div className={styles.selectionSummary} aria-live="polite"><strong>{copy.previewSelected}: {selectedIds.length}<span> · {selectedEanCount} EAN</span></strong><p className={styles.fieldHint}>{copy.confirmStep}</p></div>
                      <button className={styles.dangerButton} type="button" disabled={busy || selectedIds.length === 0} onClick={() => void confirmEnd()}>
                        {busy ? <LoaderCircle aria-hidden className={styles.spin} /> : <X aria-hidden />}
                        {interpolateEbayBulkEnd(copy.endSelected, { count: selectedIds.length })}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={styles.emptyState}>{copy.noEanMatches}</p>
                )}
              </div>
            ) : null}

            {job.status === "incomplete" ? (
              <p className={styles.warningBanner}><AlertTriangle aria-hidden /> {copy.incompleteWarning}</p>
            ) : null}
            {job.status === "expired" || previewExpired ? (
              <p className={styles.warningBanner}>{copy.expiredWarning}</p>
            ) : null}

            {jobIsFinished ? (
              <div className={styles.report}>
                <div className={styles.reportSummary}>
                  <ShieldCheck aria-hidden />
                  <p>{interpolateEbayBulkEnd(copy.endedCount, { ended: job.results.filter((result) => result.status === "ended").length, total: job.results.length })}</p>
                </div>
                <div className={styles.reportStats} aria-label={copy.reportSummary}>
                  <div><strong>{job.summary?.submitted_ean_count ?? 0}</strong><span>{copy.reportSubmitted}</span></div>
                  <div><strong>{job.summary?.listing_count ?? 0}</strong><span>{copy.reportListings}</span></div>
                  <div className={styles.reportSuccessStat}><strong>{job.summary?.ended_item_count ?? job.results.filter((result) => result.status === "ended").length}</strong><span>{copy.reportEnded}</span></div>
                  <div><strong>{job.summary?.failed_item_count ?? 0}</strong><span>{copy.reportFailed}</span></div>
                  <div><strong>{job.summary?.not_found_ean_count ?? job.unmatched_eans.length}</strong><span>{copy.reportNotFound}</span></div>
                  <div><strong>{job.summary?.uncertain_item_count ?? job.results.filter((result) => result.status === "uncertain").length}</strong><span>{copy.reportNeedsReview}</span></div>
                  <div><strong>{job.summary?.not_selected_item_count ?? 0}</strong><span>{copy.reportNotSelected}</span></div>
                </div>
                <button className={styles.secondaryButton} type="button" onClick={() => void downloadReport()}>
                  <Download aria-hidden /> {copy.downloadCsv}
                </button>
                <div className={styles.tableFrame}>
                  <table className={`${styles.resultsTable} ${styles.reportTable}`}>
                    <thead><tr><th scope="col">{copy.listing}</th><th scope="col">EAN</th><th scope="col">{copy.result}</th><th scope="col">{copy.details}</th></tr></thead>
                    <tbody>
                      {(job.report_rows ?? job.results).map((result) => (
                        <tr key={result.item_id || result.eans.join(",") + result.status} data-status={result.status}>
                          <td data-label={copy.listing}>
                            <strong className={styles.itemTitle}>{result.title || copy.untitled}</strong>
                            <div className={styles.reportMeta}>
                              <span className={styles.reportAccount} title={copy.account}>{job.account.toUpperCase()}</span>
                              {result.item_id ? <span className={styles.itemId}>ItemID {result.item_id}</span> : null}
                            </div>
                          </td>
                          <td data-label="EAN"><div className={styles.eanTags}>{result.eans.map((ean) => <span className={styles.eanTag} key={ean}>{ean}</span>)}</div></td>
                          <td data-label={copy.result}>
                            <span className={`${styles.reportStatus} ${result.status === "ended" ? styles.safeBadge : styles.statusWarning}`}>
                              {result.status === "ended" ? <Check aria-hidden /> : <AlertTriangle aria-hidden />}
                              {statusLabel(result.status, copy.status)}
                            </span>
                          </td>
                          <td data-label={copy.details}>
                            {result.message ? <p className={styles.reportMessage}>{result.message}</p> : null}
                            <dl className={styles.reportTimes}>
                              {result.error_code ? <div><dt>{copy.ebayCode}</dt><dd className={styles.reportErrorCode}>{result.error_code}</dd></div> : null}
                              {result.end_time ? <div><dt>{copy.ebayTime}</dt><dd><time dateTime={result.end_time} title={result.end_time}>{reportDateFormatter.format(new Date(result.end_time))}</time></dd></div> : null}
                              {result.finished_at ? <div><dt>{copy.processedAt}</dt><dd><time dateTime={result.finished_at}>{reportDateFormatter.format(new Date(result.finished_at))}</time></dd></div> : null}
                            </dl>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <footer className={styles.footerNote}>
          <ShieldCheck aria-hidden />
          <span>{copy.footer}</span>
        </footer>
      </div>
    </main>
  );
}
