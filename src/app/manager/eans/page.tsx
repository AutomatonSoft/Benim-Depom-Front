"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  EmptyState,
  Feedback,
  MetricCard,
  PageContainer,
  PageHeader,
  PaginationBar,
  SectionCard,
  SectionCardHeader,
  SectionToolbar,
  StatusBadge,
} from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { Textarea } from "@/components/ui/textarea";
import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n } from "@/i18n";

type Ean = { id: number; code: string; account: "jv" | "xl"; product_id: number | null; imported_at: string };
type EanList = { next: string | null; previous: string | null; results: Ean[] };
type Summary = { accounts: { account: string; available_count: number; is_low: boolean }[] };
type ImportResult = { created_count: number; already_exists_count: number; invalid_count: number };

export default function EansPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Ean[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [previous, setPrevious] = useState(false);
  const [account, setAccount] = useState("");
  const [assigned, setAssigned] = useState("");
  const [codes, setCodes] = useState("");
  const [importAccount, setImportAccount] = useState("jv");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return void window.location.replace("/manager/login");
    const params = new URLSearchParams({ page: String(page) });
    if (account) params.set("account", account);
    if (assigned) params.set("is_assigned", assigned);
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [listResponse, summaryResponse] = await Promise.all([
          authorizedFetch(`/api/v1/manager/eans/?${params}`),
          authorizedFetch("/api/v1/manager/eans/summary/"),
        ]);
        if (listResponse.status === 401 || summaryResponse.status === 401) return void window.location.replace("/manager/login");
        if (!listResponse.ok || !summaryResponse.ok) throw new Error();
        const list = (await listResponse.json()) as EanList;
        setItems(list.results);
        setNext(Boolean(list.next));
        setPrevious(Boolean(list.previous));
        setSummary((await summaryResponse.json()) as Summary);
      } catch {
        setError(t("eans.loadError"));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [page, account, assigned, refresh, t]);

  async function importCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("benim_access_token");
    if (!token) return;
    setSaving(true);
    setResult(null);
    setError("");
    try {
      const response = await authorizedFetch("/api/v1/manager/eans/import/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: importAccount, codes }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.codes?.[0] || t("eans.importFailed"));
      }
      setResult((await response.json()) as ImportResult);
      setCodes("");
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("eans.importFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader eyebrow={t("common.panel")} title={t("eans.title")} description={t("eans.subtitle")} />

      {summary ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {summary.accounts.map((item) => (
            <MetricCard
              key={item.account}
              tone={item.is_low ? "warning" : "default"}
              label={item.account.toUpperCase()}
              value={item.available_count}
              hint={item.is_low ? t("eans.lowStock") : t("eans.available")}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard>
          <SectionCardHeader eyebrow={t("eans.importEyebrow")} title={t("eans.importTitle")} />
          <form className="grid gap-3 p-5" onSubmit={importCodes}>
            <div>
              <Label htmlFor="ean-import-account">{t("eans.col.account")}</Label>
              <FilterSelect id="ean-import-account" value={importAccount} onChange={(event) => setImportAccount(event.target.value)}>
                <option value="jv">{t("eans.jvAccount")}</option>
                <option value="xl">{t("eans.xlAccount")}</option>
              </FilterSelect>
            </div>
            <div>
              <Label htmlFor="ean-codes">{t("eans.col.ean")}</Label>
              <Textarea id="ean-codes" value={codes} onChange={(event) => setCodes(event.target.value)} placeholder={t("eans.placeholder")} required rows={10} />
            </div>
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? t("eans.importing") : t("eans.import")}
            </Button>
            {result ? (
              <Feedback tone="success">
                {t("eans.result", { created: result.created_count, existing: result.already_exists_count, invalid: result.invalid_count })}
              </Feedback>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard>
          <SectionToolbar>
            <div className="flex flex-wrap gap-3">
              <FilterSelect
                className="w-[160px]"
                value={account}
                onChange={(event) => {
                  setPage(1);
                  setAccount(event.target.value);
                }}
              >
                <option value="">{t("eans.allAccounts")}</option>
                <option value="jv">JV</option>
                <option value="xl">XL</option>
              </FilterSelect>
              <FilterSelect
                className="w-[180px]"
                value={assigned}
                onChange={(event) => {
                  setPage(1);
                  setAssigned(event.target.value);
                }}
              >
                <option value="">{t("eans.all")}</option>
                <option value="false">{t("eans.availableFilter")}</option>
                <option value="true">{t("eans.assigned")}</option>
              </FilterSelect>
            </div>
          </SectionToolbar>

          {loading ? <p className="px-5 py-6 text-sm font-semibold text-muted-foreground">{t("eans.loading")}</p> : null}
          {error ? <Feedback className="px-5 py-4">{error}</Feedback> : null}
          {!loading && !error && items.length === 0 ? <EmptyState title={t("eans.availableCell")} /> : null}

          {!loading && !error && items.length > 0 ? (
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
              <div className="overflow-x-auto">
              <div className="grid min-w-[720px] grid-cols-[1.4fr_0.7fr_0.9fr_1fr] gap-3 border-b border-border bg-[#f8fafc] px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">
                <span>{t("eans.col.ean")}</span>
                <span>{t("eans.col.account")}</span>
                <span>{t("eans.col.product")}</span>
                <span>{t("eans.col.imported")}</span>
              </div>
              {items.map((item) => {
                const isAssigned = Boolean(item.product_id);
                return (
                  <article
                    key={item.id}
                    className="grid min-w-[720px] grid-cols-[1.4fr_0.7fr_0.9fr_1fr] items-center gap-3 border-b border-border px-5 py-3 text-sm"
                  >
                    <strong className="font-extrabold text-primary">{item.code}</strong>
                    <span className="font-bold text-muted-foreground">{item.account.toUpperCase()}</span>
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={isAssigned ? "assigned" : "available"}>
                        {isAssigned ? t("eans.assigned") : t("eans.availableCell")}
                      </StatusBadge>
                      {isAssigned ? <span className="text-xs font-semibold text-muted-foreground">#{item.product_id}</span> : null}
                    </div>
                    <time className="text-xs font-semibold text-muted-foreground">{formatDate(item.imported_at)}</time>
                  </article>
                );
              })}
            </div>
            </>
          ) : null}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
