"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, Search } from "lucide-react";

import { authorizedFetch } from "@/lib/api";
import { useI18n } from "@/i18n";

import styles from "./EbayBulkEndHistory.module.css";

type Page<T> = { count: number; page: number; page_size: number; pages: number; results: T[] };
type HistoryRow = {
  job_id: string;
  account: string;
  environment: string;
  manager: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  submitted_ean_count: number;
  matched_item_count: number;
  selected_item_count: number;
  ended_count: number;
  failed_count: number;
  uncertain_count: number;
  not_found_count: number;
};
type JobDetail = HistoryRow & {
  seller_id: string;
  kind: string;
  discovery_strategy: string;
  discovery_complete: boolean;
  discovery_details: Record<string, unknown>;
  input_eans: string[];
  unmatched_eans: string[];
  unmatched_status_by_ean: Record<string, string>;
  last_error: string;
  cancel_requested: boolean;
  timestamps: Record<string, string | null>;
};
type JobItem = {
  item_id: string;
  eans: string[];
  sku: string;
  title: string;
  match_type: string;
  status: string;
  selected: boolean;
  error_code: string;
  error_message: string;
  ended_at: string | null;
  processed_at: string | null;
};
type JobEvent = { event_type: string; created_at: string; actor: string; item_id: string; metadata: Record<string, unknown> };

const apiRoot = "/api/v2/ebay-bulk-end/history";
const copy = {
  en: {
    title: "eBay operation history", subtitle: "Your saved search and ending operations.", back: "Back to eBay tool",
    search: "EAN, ItemID, SKU or seller", account: "All accounts", environment: "All environments", status: "All statuses", resultFilter: "Any result", from: "From", to: "To", apply: "Apply filters", reset: "Reset",
    date: "Date", manager: "Manager", eans: "EANs", ended: "Ended", failed: "Failed", action: "Details", open: "Open", download: "Download CSV", noRows: "No saved operations match these filters.", loading: "Loading history…", error: "Could not load operation history.", denied: "Manager access is required. Sign in through the eBay tool.",
    details: "Operation details", job: "Job ID", accountLabel: "Account", environmentLabel: "Environment", seller: "eBay seller", discovery: "Discovery method", complete: "Discovery complete", submitted: "Submitted EANs", matched: "Matched ItemIDs", selected: "Selected", uncertain: "Uncertain", notFound: "Not found by SKU", final: "Final status", inputs: "Submitted values", items: "Listings", events: "Events", resultColumn: "Result", listingTitle: "Listing", sku: "SKU", itemId: "ItemID", match: "Match type", errorCode: "eBay code", errorText: "Error", endedAt: "Ended at", processedAt: "Processed at", selectedState: "Selected", notSelected: "Not selected", historyEmpty: "No listing records.", eventEmpty: "No events recorded.", previous: "Previous", next: "Next", page: "Page", unmatchedDetails: "Unmatched EAN status", verificationFailed: "SKU appeared in the report, but the listing was no longer confirmed active.", partialCoverage: "The eBay report contains SKU, not EAN. “Not found by SKU” does not prove that an EAN is absent.",
    accounts: { jv: "JV", xl: "XL", depotum: "Depotum" }, environments: { sandbox: "Sandbox", production: "Production" },
    statuses: { queued: "Queued", scanning: "Searching", preview: "Preview", ending: "Ending", complete: "Complete", partial: "Partial", failed: "Failed", uncertain: "Needs review", cancelled: "Stopped", incomplete: "Incomplete", ended: "Ended", blocked: "Blocked", changed: "Changed", not_found: "Not found", already_ended: "Already ended", ownership_mismatch: "Seller mismatch", sending: "Request sent", checking: "Checking" },
  },
  ru: {
    title: "История операций eBay", subtitle: "Сохранённые поиски и завершения объявлений.", back: "К инструменту eBay",
    search: "EAN, ItemID, SKU или продавец", account: "Все аккаунты", environment: "Все среды", status: "Все статусы", resultFilter: "Любой результат", from: "С даты", to: "По дату", apply: "Применить фильтры", reset: "Сбросить",
    date: "Дата", manager: "Менеджер", eans: "EAN", ended: "Завершено", failed: "Ошибки", action: "Детали", open: "Открыть", download: "Скачать CSV", noRows: "По этим фильтрам операций нет.", loading: "Загружаем историю…", error: "Не удалось загрузить историю операций.", denied: "Нужен доступ менеджера. Войдите через инструмент eBay.",
    details: "Детали операции", job: "ID задания", accountLabel: "Аккаунт", environmentLabel: "Среда", seller: "Продавец eBay", discovery: "Способ поиска", complete: "Поиск полный", submitted: "Передано EAN", matched: "Найдено ItemID", selected: "Выбрано", uncertain: "Неизвестный результат", notFound: "Не найдено по SKU", final: "Итоговый статус", inputs: "Введённые значения", items: "Объявления", events: "События", resultColumn: "Результат", listingTitle: "Объявление", sku: "SKU", itemId: "ItemID", match: "Тип совпадения", errorCode: "Код eBay", errorText: "Ошибка", endedAt: "Завершено eBay", processedAt: "Обработано", selectedState: "Выбрано", notSelected: "Не выбрано", historyEmpty: "Записей объявлений нет.", eventEmpty: "Событий нет.", previous: "Назад", next: "Далее", page: "Страница", unmatchedDetails: "Статус EAN без совпадения", verificationFailed: "SKU был в отчёте, но активное объявление подтвердить не удалось.", partialCoverage: "Отчёт eBay содержит SKU, но не EAN. Статус «не найдено по SKU» не доказывает отсутствие EAN на eBay.",
    accounts: { jv: "JV", xl: "XL", depotum: "Depotum" }, environments: { sandbox: "Sandbox", production: "Production" },
    statuses: { queued: "В очереди", scanning: "Поиск", preview: "Предпросмотр", ending: "Завершение", complete: "Готово", partial: "Частично", failed: "Ошибка", uncertain: "Нужно сверить", cancelled: "Остановлено", incomplete: "Неполный поиск", ended: "Завершено", blocked: "Заблокировано", changed: "Изменилось", not_found: "Не найдено", already_ended: "Уже завершено", ownership_mismatch: "Другой продавец", sending: "Запрос отправлен", checking: "Проверка" },
  },
} as const;

export default function EbayBulkEndHistory() {
  const { locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const text = locale === "ru" ? copy.ru : copy.en;
  const [rows, setRows] = useState<Page<HistoryRow> | null>(null);
  const [filters, setFilters] = useState({ q: "", account: "", environment: "", status: "", result: "", date_from: "", date_to: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [jobId, setJobId] = useState(searchParams.get("job") ?? "");
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [items, setItems] = useState<Page<JobItem> | null>(null);
  const [events, setEvents] = useState<Page<JobEvent> | null>(null);
  const [itemPage, setItemPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), page_size: "25" });
      for (const [key, value] of Object.entries(applied)) if (value) params.set(key, value);
      try {
        const response = await authorizedFetch(`${apiRoot}/?${params}`);
        if (!live) return;
        if (response.status === 401 || response.status === 403) { setDenied(true); return; }
        if (!response.ok) throw new Error();
        setRows((await response.json()) as Page<HistoryRow>);
        setDenied(false);
      } catch {
        if (live) setError(text.error);
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => { live = false; };
  }, [applied, page, text.error]);

  useEffect(() => {
    if (!jobId) {
      return;
    }
    let live = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [detailResponse, itemResponse, eventResponse] = await Promise.all([
          authorizedFetch(`${apiRoot}/${jobId}/`),
          authorizedFetch(`${apiRoot}/${jobId}/items/?page=${itemPage}&page_size=25`),
          authorizedFetch(`${apiRoot}/${jobId}/events/?page=1&page_size=10`),
        ]);
        if (!live) return;
        if ([detailResponse, itemResponse, eventResponse].some((response) => response.status === 401 || response.status === 403)) { setDenied(true); return; }
        if (![detailResponse, itemResponse, eventResponse].every((response) => response.ok)) throw new Error();
        setDetail((await detailResponse.json()) as JobDetail);
        setItems((await itemResponse.json()) as Page<JobItem>);
        setEvents((await eventResponse.json()) as Page<JobEvent>);
      } catch {
        if (live) setError(text.error);
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => { live = false; };
  }, [jobId, itemPage, text.error]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }

  function resetFilters() {
    const empty = { q: "", account: "", environment: "", status: "", result: "", date_from: "", date_to: "" };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  }

  function openJob(id: string) {
    setJobId(id);
    setItemPage(1);
    router.replace(`/ebay/history?job=${encodeURIComponent(id)}`, { scroll: false });
  }

  function closeJob() {
    setJobId("");
    setDetail(null);
    setItems(null);
    setEvents(null);
    router.replace("/ebay/history", { scroll: false });
  }

  async function downloadCsv() {
    if (!jobId) return;
    try {
      const response = await authorizedFetch(`${apiRoot}/${jobId}/csv/`);
      if (response.status === 401 || response.status === 403) { setDenied(true); return; }
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `ebay-bulk-end-${jobId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { setError(text.error); }
  }

  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB") : "—";
  const statusLabel = (value: string) => text.statuses[value as keyof typeof text.statuses] ?? value;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">Benim<span>Depom</span></Link>
        <Link className={styles.backLink} href="/ebay"><ArrowLeft aria-hidden />{text.back}</Link>
      </header>
      <div className={styles.frame}>
        <div className={styles.heading}>
          <div><p className={styles.kicker}>eBay</p><h1>{jobId ? text.details : text.title}</h1><p>{text.subtitle}</p></div>
          {detail ? <button className={styles.secondaryButton} type="button" onClick={() => void downloadCsv()}><Download aria-hidden />{text.download}</button> : null}
        </div>
        {denied ? <section className={styles.empty}><p>{text.denied}</p><Link href="/ebay">{text.back}</Link></section> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {loading ? <p className={styles.empty}>{text.loading}</p> : null}

        {!denied && !loading && !jobId ? <>
          <form className={styles.filters} onSubmit={applyFilters}>
            <label className={styles.search}><Search aria-hidden /><input aria-label={text.search} placeholder={text.search} value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></label>
            <select aria-label={text.account} value={filters.account} onChange={(event) => setFilters({ ...filters, account: event.target.value })}><option value="">{text.account}</option><option value="jv">JV</option><option value="xl">XL</option><option value="depotum">Depotum</option></select>
            <select aria-label={text.environment} value={filters.environment} onChange={(event) => setFilters({ ...filters, environment: event.target.value })}><option value="">{text.environment}</option><option value="sandbox">Sandbox</option><option value="production">Production</option></select>
            <select aria-label={text.status} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">{text.status}</option>{Object.entries(text.statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <select aria-label={text.resultFilter} value={filters.result} onChange={(event) => setFilters({ ...filters, result: event.target.value })}><option value="">{text.resultFilter}</option><option value="success">{text.ended}</option><option value="failure">{text.failed}</option><option value="uncertain">{text.uncertain}</option></select>
            <label>{text.from}<input type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} /></label>
            <label>{text.to}<input type="date" value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} /></label>
            <div className={styles.filterActions}><button className={styles.primaryButton} type="submit">{text.apply}</button><button className={styles.secondaryButton} type="button" onClick={resetFilters}>{text.reset}</button></div>
          </form>
          <p className={styles.coverage}>{text.partialCoverage}</p>
          <section className={styles.card}>
            <div className={styles.tableFrame}><table className={styles.table}>
              <thead><tr><th>{text.date}</th><th>{text.accountLabel}</th><th>{text.manager}</th><th>{text.eans}</th><th>{text.ended}</th><th>{text.failed}</th><th>{text.final}</th><th aria-label={text.action}></th></tr></thead>
              <tbody>{rows?.results.map((row) => <tr key={row.job_id}>
                <td data-label={text.date}>{formatDate(row.created_at)}</td><td data-label={text.accountLabel}>{text.accounts[row.account as keyof typeof text.accounts] ?? row.account}</td><td data-label={text.manager}>{row.manager}</td><td data-label={text.eans}>{row.submitted_ean_count}</td><td data-label={text.ended}>{row.ended_count}</td><td data-label={text.failed}>{row.failed_count}</td><td data-label={text.final}><span className={styles.status}>{statusLabel(row.status)}</span></td><td data-label={text.action}><button className={styles.openButton} type="button" onClick={() => openJob(row.job_id)}>{text.open}<ExternalLink aria-hidden /></button></td>
              </tr>)}</tbody>
            </table></div>
            {!rows?.results.length ? <p className={styles.empty}>{text.noRows}</p> : null}
            {rows && rows.pages > 1 ? <div className={styles.pagination}><button className={styles.secondaryButton} disabled={page <= 1} onClick={() => setPage(page - 1)}>{text.previous}</button><span>{text.page} {page} / {rows.pages}</span><button className={styles.secondaryButton} disabled={page >= rows.pages} onClick={() => setPage(page + 1)}>{text.next}</button></div> : null}
          </section>
        </> : null}

        {!denied && !loading && jobId && detail ? <>
          <button className={styles.secondaryButton} type="button" onClick={closeJob}><ArrowLeft aria-hidden />{text.back}</button>
          <p className={styles.coverage}>{text.partialCoverage}</p>
          <section className={styles.card}>
            <div className={styles.detailGrid}>
              <Detail label={text.job} value={detail.job_id} /><Detail label={text.accountLabel} value={text.accounts[detail.account as keyof typeof text.accounts] ?? detail.account} />
              <Detail label={text.environmentLabel} value={text.environments[detail.environment as keyof typeof text.environments] ?? detail.environment} /><Detail label={text.manager} value={detail.manager} />
              <Detail label={text.seller} value={detail.seller_id} /><Detail label={text.date} value={formatDate(detail.created_at)} />
              <Detail label={text.discovery} value={detail.discovery_strategy || "—"} /><Detail label={text.complete} value={detail.discovery_complete ? "Yes" : "No"} />
              <Detail label={text.submitted} value={detail.submitted_ean_count} /><Detail label={text.matched} value={detail.matched_item_count} />
              <Detail label={text.selected} value={detail.selected_item_count} /><Detail label={text.ended} value={detail.ended_count} />
              <Detail label={text.failed} value={detail.failed_count} /><Detail label={text.uncertain} value={detail.uncertain_count} />
              <Detail label={text.notFound} value={detail.not_found_count} /><Detail label={text.final} value={statusLabel(detail.status)} />
            </div>
            <h2>{text.inputs}</h2><p className={styles.eans}>{detail.input_eans.join(", ") || "—"}</p>
            {detail.unmatched_eans.length ? <><h2>{text.unmatchedDetails}</h2><p className={styles.eans}>{detail.unmatched_eans.map((ean) => `${ean}: ${detail.unmatched_status_by_ean[ean] === "verification_failed" ? text.verificationFailed : text.notFound}`).join("\n")}</p></> : null}
          </section>
          <section className={styles.card}><h2>{text.items}</h2><div className={styles.tableFrame}><table className={styles.table}><thead><tr><th>{text.eans}</th><th>{text.sku}</th><th>{text.itemId}</th><th>{text.listingTitle}</th><th>{text.match}</th><th>{text.resultColumn}</th><th>{text.errorCode}</th><th>{text.errorText}</th><th>{text.endedAt}</th><th>{text.processedAt}</th></tr></thead><tbody>{items?.results.map((item) => <tr key={item.item_id}><td data-label={text.eans}>{item.eans.join(", ")}</td><td data-label={text.sku}>{item.sku || "—"}</td><td data-label={text.itemId}>{item.item_id}</td><td data-label={text.listingTitle}>{item.title || "—"}</td><td data-label={text.match}>{item.match_type || "—"}</td><td data-label={text.resultColumn}><span className={`${styles.status} ${item.status === "ended" ? styles.statusSuccess : item.status === "uncertain" || item.status === "sending" ? styles.statusUncertain : item.status === "failed" || item.status === "blocked" ? styles.statusFailure : ""}`}>{statusLabel(item.status)}</span></td><td data-label={text.errorCode}>{item.error_code || "—"}</td><td data-label={text.errorText}>{item.error_message || "—"}</td><td data-label={text.endedAt}>{formatDate(item.ended_at)}</td><td data-label={text.processedAt}>{formatDate(item.processed_at)}</td></tr>)}</tbody></table></div>{!items?.results.length ? <p className={styles.empty}>{text.historyEmpty}</p> : null}{items && items.pages > 1 ? <div className={styles.pagination}><button className={styles.secondaryButton} disabled={itemPage <= 1} onClick={() => setItemPage(itemPage - 1)}>{text.previous}</button><span>{text.page} {itemPage} / {items.pages}</span><button className={styles.secondaryButton} disabled={itemPage >= items.pages} onClick={() => setItemPage(itemPage + 1)}>{text.next}</button></div> : null}</section>
          <section className={styles.card}><h2>{text.events}</h2><ol className={styles.events}>{events?.results.map((event, index) => <li key={`${event.event_type}-${event.created_at}-${index}`}><time>{formatDate(event.created_at)}</time><strong>{event.event_type}</strong><span>{event.item_id || event.actor}</span></li>)}</ol>{!events?.results.length ? <p className={styles.empty}>{text.eventEmpty}</p> : null}</section>
        </> : null}
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return <div className={styles.detail}><dt>{label}</dt><dd>{value === 0 ? 0 : value || "—"}</dd></div>;
}
