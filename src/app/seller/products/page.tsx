"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Ellipsis, FileClock, Package, Plus, Search, SlidersHorizontal } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import SellerProductImage from "@/components/seller/SellerProductImage";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sellerRequest, type PageResult, type SellerProduct } from "@/lib/seller";

const statuses = ["", "draft", "submitted", "approved", "rejected", "withdrawn", "deactivated", "archived"];
const statusLabel: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Needs changes",
  withdrawn: "Withdrawn", deactivated: "Deactivated", archived: "Archived",
};
const sortOptions = [
  ["-created_at", "Newest first"], ["created_at", "Oldest first"],
  ["-updated_at", "Recently updated"], ["title", "Name A–Z"],
] as const;

type Translate = (text: string, vars?: Record<string, string | number>) => string;

function FilterFields({
  t, status, available, setStatus, setAvailable,
}: {
  t: Translate;
  status: string;
  available: string;
  setStatus: (value: string) => void;
  setAvailable: (value: string) => void;
}) {
  return <>
    <Select aria-label={t("Product status")} value={status} onChange={e => setStatus(e.target.value)}>
      {statuses.map(value => <option value={value} key={value}>{value ? t(statusLabel[value]) : t("All statuses")}</option>)}
    </Select>
    <Select aria-label={t("Availability")} value={available} onChange={e => setAvailable(e.target.value)}>
      <option value="">{t("Any availability")}</option>
      <option value="true">{t("Available")}</option>
      <option value="false">{t("Unavailable")}</option>
    </Select>
  </>;
}

function SortSelect({ t, value, onChange }: { t: Translate; value: string; onChange: (value: string) => void }) {
  return <Select aria-label={t("Sort products")} value={value} onChange={e => onChange(e.target.value)}>
    {sortOptions.map(([key, label]) => <option value={key} key={key}>{t(label)}</option>)}
  </Select>;
}

function ProductActions({ product, t }: { product: SellerProduct; t: Translate }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="seller-product-menu" aria-label={t("Product actions for {title}", { title: product.title })}>
        <Ellipsis size={18} strokeWidth={1.8} aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem asChild><Link href={`/seller/products/${product.id}`}>{t("View product")}</Link></DropdownMenuItem>
      {(["draft", "rejected", "withdrawn", "approved"].includes(product.status)) &&
        <DropdownMenuItem asChild><Link href={`/seller/products/${product.id}/edit`}>{t("Edit product")}</Link></DropdownMenuItem>}
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild><Link href={`/seller/products/${product.id}/history`}><FileClock size={18} strokeWidth={1.8} aria-hidden="true" />{t("Review history")}</Link></DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function StatusBadges({ product, t }: { product: SellerProduct; t: Translate }) {
  return <div className="seller-product-badges">
    <span className={`seller-badge ${product.status}`}>{t(statusLabel[product.status] || product.status.replaceAll("_", " "))}</span>
    {product.deactivation_requested_at && <span className="seller-badge pending">{t("Deactivation requested")}</span>}
    {product.deactivated_at && <span className="seller-badge deactivated">{t("Deactivated")}</span>}
    {!product.is_available && <span className="seller-badge">{t("Unavailable")}</span>}
  </div>;
}

function ProductPhoto({ product, t }: { product: SellerProduct; t: Translate }) {
  const image = product.images?.[0];
  return image?.thumbnail || image?.image
    ? <SellerProductImage src={image.thumbnail || image.image} alt={t("Product photo")} />
    : <div className="seller-image-placeholder" aria-label={t("No product photo available")}><Package size={22} aria-hidden="true" /></div>;
}

export default function SellerProductsPage() {
  const { t, locale } = useSellerI18n();
  const [page, setPage] = useState<PageResult<SellerProduct> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [available, setAvailable] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(pageNumber), ordering });
    if (search.trim()) query.set("search", search.trim());
    if (status) query.set("status", status);
    if (available) query.set("is_available", available);
    try {
      setPage(await sellerRequest<PageResult<SellerProduct>>(`/api/v1/products/?${query}`, { signal }));
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load products.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [pageNumber, ordering, search, status, available]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  function changeFilter(setter: (value: string) => void, value: string) {
    setPageNumber(1);
    setter(value);
  }

  const filters = <FilterFields
    t={t}
    status={status}
    available={available}
    setStatus={value => changeFilter(setStatus, value)}
    setAvailable={value => changeFilter(setAvailable, value)}
  />;
  const quantityFormat = new Intl.NumberFormat(locale);

  return <SellerPage
    title="My products"
    description="Manage your catalogue and track product review status."
    actions={<Button asChild variant="accent" className="seller-button primary"><Link href="/seller/products/new"><Plus size={18} strokeWidth={1.8} aria-hidden="true" />{t("Add product")}</Link></Button>}
  >
    <div className="seller-products-toolbar">
      <label className="seller-product-search">
        <span className="sr-only">{t("Search products")}</span>
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
        <Input value={search} onChange={e => changeFilter(setSearch, e.target.value)} placeholder={t("Search by product name or EAN")} />
      </label>
      <div className="seller-product-filters">{filters}<SortSelect t={t} value={ordering} onChange={value => changeFilter(setOrdering, value)} /></div>
      <div className="seller-product-mobile-filters">
        <SortSelect t={t} value={ordering} onChange={value => changeFilter(setOrdering, value)} />
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" className="seller-button"><SlidersHorizontal size={18} strokeWidth={1.8} aria-hidden="true" />{t("Filters")}{(status || available) ? <span className="seller-filter-dot" aria-label={t("Active filters")} /> : null}</Button></SheetTrigger>
          <SheetContent side="bottom" className="seller-filter-sheet">
            <SheetHeader>
              <SheetTitle>{t("Filter products")}</SheetTitle>
              <SheetDescription>{t("Choose product status and availability.")}</SheetDescription>
            </SheetHeader>
            <div className="seller-filter-sheet-fields">{filters}</div>
            <SheetFooter><SheetClose asChild><Button variant="accent" className="seller-button primary">{t("Done")}</Button></SheetClose></SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </div>

    {error ? <SellerNotice>{error} <button type="button" className="seller-inline-retry" onClick={() => void load()}>{t("Try again")}</button></SellerNotice> : loading ?
      <SellerLoadingState label={t("Loading products…")} rows={4} /> : page?.results.length ? <>
        <div className="seller-products-table-wrap">
          <Table className="seller-product-table" aria-label={t("My products")}>
            <TableHeader><TableRow>
              <TableHead>{t("Product")}</TableHead><TableHead>{t("Status")}</TableHead>
              <TableHead className="seller-numeric-cell">{t("Unit price")}</TableHead><TableHead className="seller-numeric-cell">{t("Quantity")}</TableHead>
              <TableHead>{t("Dimensions")}</TableHead><TableHead>{t("Updated")}</TableHead>
              <TableHead><span className="sr-only">{t("Actions")}</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{page.results.map(product => {
              const variant = product.variants?.[0];
              return <TableRow key={product.id}>
                <TableCell><div className="seller-table-product"><ProductPhoto product={product} t={t} /><div>
                  <Link className="seller-link" data-seller-translate="skip" href={`/seller/products/${product.id}`}>{product.title}</Link>
                  <span data-seller-translate="skip">{product.product_type}</span>
                </div></div></TableCell>
                <TableCell><StatusBadges product={product} t={t} /></TableCell>
                <TableCell className="seller-numeric-cell"><strong data-seller-translate="skip">{product.unit_price} {product.currency}</strong></TableCell>
                <TableCell className="seller-numeric-cell"><span data-seller-translate="skip">{quantityFormat.format(product.total_quantity)}</span> {t("units")}</TableCell>
                <TableCell><span data-seller-translate="skip">{variant ? `${variant.width_cm} × ${variant.height_cm} × ${variant.length_cm} cm` : t("Dimensions not provided")}</span></TableCell>
                <TableCell>{new Date(product.updated_at).toLocaleDateString(locale)}</TableCell>
                <TableCell><ProductActions product={product} t={t} /></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </div>
        <div className="seller-products-mobile">{page.results.map(product => <article className="seller-product" key={product.id}>
          <ProductPhoto product={product} t={t} />
          <div className="seller-product-summary">
            <h2><Link className="seller-link" data-seller-translate="skip" href={`/seller/products/${product.id}`}>{product.title}</Link></h2>
            <p data-seller-translate="skip">{product.product_type}</p>
            <p><strong data-seller-translate="skip">{product.unit_price} {product.currency}</strong> · <span data-seller-translate="skip">{quantityFormat.format(product.total_quantity)}</span> {t("units")}</p>
            <StatusBadges product={product} t={t} />
          </div>
          <div className="seller-product-actions">
            <ProductActions product={product} t={t} />
          </div>
        </article>)}</div>
      </> : <div className="seller-empty seller-products-empty">
        <Package size={28} aria-hidden="true" />
        <strong>{t(search || status || available ? "No products found." : "Your catalogue is empty.")}</strong>
        <span>{t(search || status || available ? "Try changing your search or filters." : "Add your first product to start your catalogue.")}</span>
        {!search && !status && !available && <Button asChild variant="accent" className="seller-button primary"><Link href="/seller/products/new"><Plus size={18} strokeWidth={1.8} aria-hidden="true" />{t("Add product")}</Link></Button>}
      </div>}

    {page && !error && <div className="seller-pagination">
      <Button variant="outline" className="seller-button" disabled={!page.previous || loading} onClick={() => setPageNumber(value => Math.max(1, value - 1))}>{t("Previous")}</Button>
      <span>{t("{count} products · Page {page}", { count: page.count, page: pageNumber })}</span>
      <Button variant="outline" className="seller-button" disabled={!page.next || loading} onClick={() => setPageNumber(value => value + 1)}>{t("Next page")}</Button>
    </div>}
  </SellerPage>;
}
