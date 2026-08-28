"use client";

import { FormEvent, useEffect, useState } from "react";

import Sidebar from "@/components/Sidebar";
import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";

type Ean = { id: number; code: string; account: "jv" | "xl"; product_id: number | null; imported_at: string };
type EanList = { next: string | null; previous: string | null; results: Ean[] };
type Summary = { accounts: { account: string; available_count: number; is_low: boolean }[] };
type ImportResult = { created_count: number; already_exists_count: number; invalid_count: number };

export default function EansPage() {
  const [items, setItems] = useState<Ean[]>([]); const [summary, setSummary] = useState<Summary | null>(null); const [page, setPage] = useState(1); const [next, setNext] = useState(false); const [previous, setPrevious] = useState(false); const [account, setAccount] = useState(""); const [assigned, setAssigned] = useState(""); const [codes, setCodes] = useState(""); const [importAccount, setImportAccount] = useState("jv"); const [result, setResult] = useState<ImportResult | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("benim_access_token"); if (!token) return void window.location.replace("/login");
    const params = new URLSearchParams({ page: String(page) }); if (account) params.set("account", account); if (assigned) params.set("is_assigned", assigned);
    async function load() {
      setLoading(true); setError("");
      try { const [listResponse, summaryResponse] = await Promise.all([authorizedFetch(`/api/v1/manager/eans/?${params}`), authorizedFetch("/api/v1/manager/eans/summary/")]); if (listResponse.status === 401 || summaryResponse.status === 401) return void window.location.replace("/login"); if (!listResponse.ok || !summaryResponse.ok) throw new Error(); const list = await listResponse.json() as EanList; setItems(list.results); setNext(Boolean(list.next)); setPrevious(Boolean(list.previous)); setSummary(await summaryResponse.json() as Summary); } catch { setError("Unable to load EAN data. Please try again."); } finally { setLoading(false); }
    }
    void load();
  }, [page, account, assigned, refresh]);

  async function importCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const token = localStorage.getItem("benim_access_token"); if (!token) return; setSaving(true); setResult(null); setError("");
    try { const response = await authorizedFetch("/api/v1/manager/eans/import/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account: importAccount, codes }) }); if (!response.ok) { const data = await response.json(); throw new Error(data.codes?.[0] || "Import failed."); } setResult(await response.json() as ImportResult); setCodes(""); setRefresh((value) => value + 1); } catch (reason) { setError(reason instanceof Error ? reason.message : "Import failed."); } finally { setSaving(false); }
  }

  return <main className="app-shell"><Sidebar active="eans" /><section className="content products-page"><header className="topbar"><div><p className="eyebrow">Manager panel</p><h1>EAN</h1><p className="products-subtitle">Import and monitor marketplace EAN pools</p></div></header>
    {summary && <section className="ean-summary">{summary.accounts.map((item) => <article className={item.is_low ? "low" : ""} key={item.account}><span>{item.account.toUpperCase()}</span><strong>{item.available_count}</strong><small>{item.is_low ? "Low stock" : "Available EANs"}</small></article>)}</section>}
    <section className="ean-grid"><form className="ean-import" onSubmit={importCodes}><p className="eyebrow">Import EAN pool</p><h2>Add EAN codes</h2><select value={importAccount} onChange={(event) => setImportAccount(event.target.value)}><option value="jv">JV account</option><option value="xl">XL account</option></select><textarea value={codes} onChange={(event) => setCodes(event.target.value)} placeholder="One valid EAN per line" required /><button disabled={saving}>{saving ? "Importing..." : "Import EANs"}</button>{result && <p className="ean-result">Added: {result.created_count}; existing: {result.already_exists_count}; invalid: {result.invalid_count}.</p>}</form>
      <section className="ean-list"><div className="products-toolbar"><select value={account} onChange={(event) => { setPage(1); setAccount(event.target.value); }}><option value="">All accounts</option><option value="jv">JV</option><option value="xl">XL</option></select><select value={assigned} onChange={(event) => { setPage(1); setAssigned(event.target.value); }}><option value="">All EANs</option><option value="false">Available</option><option value="true">Assigned</option></select></div>{loading && <p className="products-message">Loading EANs...</p>}{error && <p className="products-message error">{error}</p>}{!loading && !error && <div className="ean-table"><div className="ean-header"><span>EAN</span><span>Account</span><span>Product</span><span>Imported</span></div>{items.map((item) => <article key={item.id}><strong>{item.code}</strong><span>{item.account.toUpperCase()}</span><span>{item.product_id ? `#${item.product_id}` : "Available"}</span><time>{formatDate(item.imported_at)}</time></article>)}</div>}<footer className="pagination"><button disabled={!previous || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page}</span><button disabled={!next || loading} onClick={() => setPage((value) => value + 1)}>Next</button></footer></section>
    </section></section></main>;
}
