"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Package } from "lucide-react";
import { SellerNotice, SellerPage } from "@/components/SellerShell";
import SellerProductImage from "@/components/seller/SellerProductImage";
import { sellerRequest, type PageResult, type SellerProduct } from "@/lib/seller";
import { useSellerI18n } from "@/components/seller/SellerI18n";

const statuses = ["", "draft", "submitted", "approved", "rejected", "withdrawn", "deactivated"];
const statusLabel: Record<string,string> = { draft:"Draft", submitted:"Submitted", approved:"Approved", rejected:"Needs changes", withdrawn:"Withdrawn", deactivated:"Deactivated", archived:"Archived" };

export default function SellerProductsPage() {
  const { t } = useSellerI18n();
  const [page, setPage] = useState<PageResult<SellerProduct> | null>(null);
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [available, setAvailable] = useState("");
  const [ordering, setOrdering] = useState("-created_at"); const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    const query = new URLSearchParams({ page: String(pageNumber), ordering });
    if (search.trim()) query.set("search", search.trim()); if (status) query.set("status", status); if (available) query.set("is_available", available);
    try { setPage(await sellerRequest<PageResult<SellerProduct>>(`/api/v1/products/?${query}`, { signal })); }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load products."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [pageNumber, ordering, search, status, available]);
  useEffect(() => { const c = new AbortController(); const timer = setTimeout(() => void load(c.signal), search ? 300 : 0); return () => { clearTimeout(timer); c.abort(); }; }, [load, search]);
  function changeFilter(setter: (value: string) => void, value: string) { setPageNumber(1); setter(value); }

  return <SellerPage title="My products" description="Manage your catalogue and track product review status." actions={<Link className="seller-button primary" href="/seller/products/new"><Plus size={17}/> Add product</Link>}>
    <div className="seller-toolbar">
      <label className="search" style={{position:"relative"}}><span className="sr-only">Search products</span><Search size={17} style={{position:"absolute",left:12,top:13,color:"#78899b"}}/><input style={{paddingLeft:38}} value={search} onChange={e=>changeFilter(setSearch,e.target.value)} placeholder="Search by product name or EAN"/></label>
      <select aria-label="Product status" value={status} onChange={e=>changeFilter(setStatus,e.target.value)}>{statuses.map(v=><option value={v} key={v}>{v ? statusLabel[v] : "All statuses"}</option>)}</select>
      <select aria-label="Availability" value={available} onChange={e=>changeFilter(setAvailable,e.target.value)}><option value="">Any availability</option><option value="true">Available</option><option value="false">Unavailable</option></select>
      <select aria-label="Sort products" value={ordering} onChange={e=>changeFilter(setOrdering,e.target.value)}><option value="-created_at">Newest first</option><option value="created_at">Oldest first</option><option value="-updated_at">Recently updated</option><option value="title">Name A–Z</option></select>
    </div>
    {error && <SellerNotice>{error}</SellerNotice>}
    {loading ? <p className="seller-empty">Loading products…</p> : page?.results.length ? <div className="seller-products">{page.results.map(product=><article className="seller-product" key={product.id}>
      {product.images?.[0]?.thumbnail || product.images?.[0]?.image ? <SellerProductImage src={product.images[0].thumbnail || product.images[0].image} alt=""/> : <div className="seller-image-placeholder"><Package/></div>}
      <div><h2><Link data-seller-translate="skip" className="seller-link" href={`/seller/products/${product.id}`}>{product.title}</Link></h2><p><span data-seller-translate="skip">{product.product_type} · {product.total_quantity}</span> {t("units")} · <span data-seller-translate="skip">{product.unit_price} {product.currency}</span></p><p data-seller-translate="skip">{product.variants?.[0] ? `${product.variants[0].width_cm} × ${product.variants[0].height_cm} × ${product.variants[0].length_cm} cm` : t("Dimensions not provided")}</p><span className={`seller-badge ${product.status}`}>{statusLabel[product.status] || product.status}</span>{!product.is_available && <span className="seller-badge" style={{marginLeft:6}}>Unavailable</span>}</div>
      <div className="seller-product-actions"><Link className="seller-button" href={`/seller/products/${product.id}`}>View</Link>{["draft","rejected","approved"].includes(product.status) && <Link className="seller-button" href={`/seller/products/${product.id}/edit`}>Edit</Link>}</div>
    </article>)}</div> : <div className="seller-card seller-empty">No products found. Add a product to start your catalogue.</div>}
    {page && <div className="seller-pagination"><button className="seller-button" disabled={!page.previous || loading} onClick={()=>setPageNumber(n=>Math.max(1,n-1))}>Previous</button><span>{t("{count} products · Page {page}",{count:page.count,page:pageNumber})}</span><button className="seller-button" disabled={!page.next || loading} onClick={()=>setPageNumber(n=>n+1)}>Load more</button></div>}
  </SellerPage>;
}
