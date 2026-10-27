"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Ellipsis, FileClock, Package, Pencil, Plus, Search, SlidersHorizontal, Trash2, Undo2 } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import SellerProductImage from "@/components/seller/SellerProductImage";
import SellerModerationHistoryDialog from "@/components/seller/SellerModerationHistoryDialog";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { SellerSelect } from "@/components/seller/SellerSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { sellerProductTypeLabel } from "@/lib/seller-product-form";

const statuses = ["", "submitted", "approved", "rejected", "withdrawn", "deactivated"];
const statusLabel: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected",
  withdrawn: "Withdrawn", deactivated: "Deactivated", archived: "Archived",
};
const sortOptions = [
  ["-created_at", "Newest first"], ["created_at", "Oldest first"],
  ["-updated_at", "Recently updated"],
] as const;
const saveMessages: Record<string, string> = {
  "created-review": "New product sent for review.",
  "created": "Product created.",
  "updated-review": "Your changes were sent for review.",
  "updated": "Product saved.",
};

type Translate = (text: string, vars?: Record<string, string | number>) => string;
type ProductAction = { id: number; type: "withdraw" | "delete" | "deactivate" };
const actionCopy = {
  withdraw: { title: "Withdraw submission", description: "Withdraw this submission from review?", button: "Withdraw" },
  delete: { title: "Delete product", description: "Delete this product?", button: "Delete product" },
  deactivate: { title: "Deactivate product", description: "Deactivate this product?", button: "Confirm" },
};

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
    <SellerSelect ariaLabel={t("Product status")} placeholder={t("All statuses")} value={status} onValueChange={setStatus}
      options={statuses.map(value => ({ value, label: value ? t(statusLabel[value]) : t("All statuses") }))} />
    <SellerSelect ariaLabel={t("Availability")} placeholder={t("Any availability")} value={available} onValueChange={setAvailable}
      options={[["", t("Any availability")], ["true", t("Available")], ["false", t("Unavailable")]].map(([value, label]) => ({ value, label }))} />
  </>;
}

function SortSelect({ t, value, onChange }: { t: Translate; value: string; onChange: (value: string) => void }) {
  return <SellerSelect ariaLabel={t("Sort products")} placeholder={t("Sort products")} value={value} onValueChange={onChange}
    options={sortOptions.map(([key, label]) => ({ value: key, label: t(label) }))} />;
}

function ProductActions({ product, t, onHistory, onAction }: { product: SellerProduct; t: Translate; onHistory: (id: number) => void; onAction: (action: ProductAction) => void }) {
  const [open, setOpen] = useState(false);
  const touchPress = useRef(false);
  const canEdit = ["draft", "rejected", "withdrawn", "approved"].includes(product.status);
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="seller-product-menu" aria-label={t("Product actions for {title}", { title: product.title })}
        onPointerDown={event => {
          touchPress.current = event.pointerType === "touch";
          if (touchPress.current) event.preventDefault();
        }}
        onPointerCancel={() => { touchPress.current = false; }}
        onClick={event => { if (touchPress.current && event.detail > 0) setOpen(current => !current); touchPress.current = false; }}>
        <Ellipsis size={18} strokeWidth={1.8} aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="seller-product-actions-menu">
      {product.status === "submitted" && <>
        <DropdownMenuItem onSelect={() => onAction({ id: product.id, type: "withdraw" })}><span className="seller-product-menu-item-content"><Undo2 size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Withdraw")}</span></span></DropdownMenuItem>
        <DropdownMenuSeparator />
      </>}
      {canEdit && <>
        <DropdownMenuItem asChild><Link href={`/seller/products/${product.id}`}><span className="seller-product-menu-item-content"><Pencil size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Edit product")}</span></span></Link></DropdownMenuItem>
        <DropdownMenuSeparator />
      </>}
      <DropdownMenuItem onSelect={() => onHistory(product.id)}><span className="seller-product-menu-item-content"><FileClock size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Moderation history")}</span></span></DropdownMenuItem>
      {product.status === "approved" && !product.deactivated_at && !product.deactivation_requested_at && <>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction({ id: product.id, type: "deactivate" })}><span className="seller-product-menu-item-content"><Ban size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Deactivate product")}</span></span></DropdownMenuItem>
      </>}
      {["draft", "rejected", "withdrawn"].includes(product.status) && <>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="seller-product-delete-item" onSelect={() => onAction({ id: product.id, type: "delete" })}><span className="seller-product-menu-item-content"><Trash2 size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Delete product")}</span></span></DropdownMenuItem>
      </>}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function ProductStatus({ product, t }: { product: SellerProduct; t: Translate }) {
  const deactivated = product.status === "deactivated" || Boolean(product.deactivation_requested_at || product.deactivated_at);
  return <div className="seller-product-badges">
    {deactivated
      ? <span className="seller-badge deactivated">{t("Deactivated")}</span>
      : <span className={`seller-badge ${product.status}`}>{t(statusLabel[product.status] || product.status.replaceAll("_", " "))}</span>}
  </div>;
}

function ProductAvailability({ product, t }: { product: SellerProduct; t: Translate }) {
  return <span className={`seller-product-availability ${product.is_available ? "available" : "unavailable"}`}>
    {t(product.is_available ? "Available" : "Unavailable")}
  </span>;
}

function ProductPhoto({ product, t }: { product: SellerProduct; t: Translate }) {
  const image = product.images?.[0];
  return image?.thumbnail || image?.image
    ? <SellerProductImage src={image.thumbnail || image.image} alt={t("Product photo")} />
    : <div className="seller-image-placeholder" aria-label={t("No product photo available")}><Package size={22} aria-hidden="true" /></div>;
}

function ProductTimestamp({ value, locale }: { value: string; locale: string }) {
  const date = new Date(value);
  return <time dateTime={value} className="seller-product-timestamp" data-seller-translate="skip">
    <span>{date.toLocaleDateString(locale)}</span>
    <small>{date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>
  </time>;
}

export default function SellerProductsPage() {
  const { t, locale } = useSellerI18n();
  const router = useRouter();
  const [page, setPage] = useState<PageResult<SellerProduct> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [available, setAvailable] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [pageNumber, setPageNumber] = useState(1);
  const [historyProductId, setHistoryProductId] = useState<number | null>(null);
  const [action, setAction] = useState<ProductAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const actionInFlight = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const result = url.searchParams.get("saved");
      if (!result || !Object.hasOwn(saveMessages, result)) return;
      setSaveNotice(saveMessages[result]);
      url.searchParams.delete("saved");
      window.history.replaceState(window.history.state, "", url);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(pageNumber), ordering });
    if (search.trim()) query.set("search", search.trim());
    if (status) query.set("status", status);
    if (available) query.set("is_available", available);
    try {
      setPage(await sellerRequest<PageResult<SellerProduct>>(`/api/v2/products/?${query}`, { signal }));
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

  function requestAction(action: ProductAction) {
    setActionError("");
    setAction(action);
  }

  async function confirmProductAction() {
    if (!action || actionInFlight.current) return;
    actionInFlight.current = true;
    setActionBusy(true);
    setActionError("");
    try {
      if (action.type === "delete") await sellerRequest(`/api/v2/products/${action.id}/`, { method: "DELETE" });
      else await sellerRequest(`/api/v2/products/${action.id}/${action.type}/`, { method: "POST", body: "{}" });
      setAction(null);
      const leavesFilter = action.type === "delete" || (action.type === "withdraw" && status === "submitted") || (action.type === "deactivate" && status === "approved");
      if (leavesFilter && page?.results.length === 1 && pageNumber > 1) setPageNumber(value => value - 1);
      else await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("Action failed."));
    } finally {
      actionInFlight.current = false;
      setActionBusy(false);
    }
  }

  const filters = <FilterFields
    t={t}
    status={status}
    available={available}
    setStatus={value => changeFilter(setStatus, value)}
    setAvailable={value => changeFilter(setAvailable, value)}
  />;
  const quantityFormat = new Intl.NumberFormat(locale);
  const pageCount = Math.max(1, Math.ceil((page?.count ?? 0) / 10));
  const firstPageNumber = Math.max(1, Math.min(pageNumber - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPageNumber + index);
  const confirmationCopy = actionCopy[action?.type ?? "withdraw"];

  return <SellerPage
    title="My products"
    description="Manage your catalogue and track product review status."
    actions={<Link href="/seller/products/new" className="seller-button primary seller-add-product seller-link-content"><Plus size={18} strokeWidth={1.8} aria-hidden="true" />{t("Add product")}</Link>}
  >
    {saveNotice && <SellerNotice kind="success">{t(saveNotice)}</SellerNotice>}
    <div className="seller-products-toolbar">
      <label className="seller-product-search">
        <span className="sr-only">{t("Search products")}</span>
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
        <Input value={search} onChange={e => changeFilter(setSearch, e.target.value)} placeholder={t("Search by product name")} />
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

    {page && page.count > 0 && !error && <div className="seller-products-listbar">
      <span>{t("{count} products · Page {page}", { count: page.count, page: pageNumber })}</span>
      <nav className="seller-pagination seller-products-pagination" aria-label={t("Product pages")}>
        <button className="seller-button" aria-label={t("Previous")} title={t("Previous")} disabled={!page.previous || loading} onClick={() => setPageNumber(value => Math.max(1, value - 1))}><ChevronLeft size={16} aria-hidden="true" /></button>
        {pageNumbers.map(number => <button key={number} className={`seller-button${number === pageNumber ? " active" : ""}`} aria-label={t("Page {page}", { page: number })} aria-current={number === pageNumber ? "page" : undefined} disabled={loading} onClick={() => setPageNumber(number)}>{number}</button>)}
        <button className="seller-button" aria-label={t("Next page")} title={t("Next page")} disabled={!page.next || loading} onClick={() => setPageNumber(value => value + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
      </nav>
    </div>}
    {error ? <SellerNotice>{error} <button type="button" className="seller-inline-retry" onClick={() => void load()}>{t("Try again")}</button></SellerNotice> : loading ?
      <SellerLoadingState label={t("Loading products…")} rows={4} /> : page?.results.length ? <>
        <div className="seller-products-table-wrap">
          <Table className="seller-product-table" aria-label={t("My products")}>
            <TableHeader><TableRow>
              <TableHead>{t("Product")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead>{t("Stock availability")}</TableHead>
              <TableHead className="seller-numeric-cell">{t("Unit price")}</TableHead><TableHead className="seller-numeric-cell">{t("Quantity")}</TableHead>
              <TableHead>{t("Created")}</TableHead><TableHead>{t("Updated")}</TableHead>
              <TableHead><span className="sr-only">{t("Actions")}</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{page.results.map(product => {
              return <TableRow key={product.id}>
                <TableCell><div className="seller-table-product"><ProductPhoto product={product} t={t} /><div>
                  <button type="button" className="seller-link seller-link-button seller-product-title-button" data-seller-translate="skip" onClick={() => router.push(`/seller/products/${product.id}`)}>{product.title}</button>
                  <span>{t(sellerProductTypeLabel(product.product_type))}</span>
                </div></div></TableCell>
                <TableCell><ProductStatus product={product} t={t} /></TableCell>
                <TableCell><ProductAvailability product={product} t={t} /></TableCell>
                <TableCell className="seller-numeric-cell"><strong className="seller-product-price" data-seller-translate="skip">{product.unit_price} <small>{product.currency}</small></strong></TableCell>
                <TableCell className="seller-numeric-cell seller-product-quantity"><span data-seller-translate="skip">{quantityFormat.format(product.total_quantity)}</span> <small>{t("units")}</small></TableCell>
                <TableCell><ProductTimestamp value={product.created_at} locale={locale} /></TableCell>
                <TableCell><ProductTimestamp value={product.updated_at} locale={locale} /></TableCell>
                <TableCell><ProductActions product={product} t={t} onHistory={setHistoryProductId} onAction={requestAction} /></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </div>
        <div className="seller-products-mobile">{page.results.map(product => {
          return <article className="seller-product" key={product.id}>
            <ProductPhoto product={product} t={t} />
            <div className="seller-product-summary">
              <h2><button type="button" className="seller-link seller-link-button seller-product-title-button" data-seller-translate="skip" onClick={() => router.push(`/seller/products/${product.id}`)}>{product.title}</button></h2>
              <p>{t(sellerProductTypeLabel(product.product_type))}</p>
              <p><strong data-seller-translate="skip">{product.unit_price} {product.currency}</strong> · <span data-seller-translate="skip">{quantityFormat.format(product.total_quantity)}</span> {t("units")}</p>
              <div className="seller-product-state-grid">
                <div><span>{t("Status")}</span><ProductStatus product={product} t={t} /></div>
                <div><span>{t("Stock availability")}</span><ProductAvailability product={product} t={t} /></div>
              </div>
              <div className="seller-product-dates"><div><span>{t("Created")}</span><ProductTimestamp value={product.created_at} locale={locale} /></div><div><span>{t("Updated")}</span><ProductTimestamp value={product.updated_at} locale={locale} /></div></div>
            </div>
            <div className="seller-product-actions">
              <ProductActions product={product} t={t} onHistory={setHistoryProductId} onAction={requestAction} />
            </div>
          </article>;
        })}</div>
      </> : <div className="seller-empty seller-products-empty">
        <Package size={28} aria-hidden="true" />
        <strong>{t(search || status || available ? "No products found." : "Your catalogue is empty.")}</strong>
        <span>{t(search || status || available ? "Try changing your search or filters." : "Add your first product to start your catalogue.")}</span>
        {!search && !status && !available && <Button asChild variant="accent" className="seller-button primary seller-add-product"><Link href="/seller/products/new"><span className="seller-link-content"><Plus key="add-product-icon" size={18} strokeWidth={1.8} aria-hidden="true" />{t("Add product")}</span></Link></Button>}
      </div>}

    <SellerModerationHistoryDialog productId={historyProductId} onClose={() => setHistoryProductId(null)} />
    <AlertDialog open={action !== null} onOpenChange={open => { if (!open && !actionInFlight.current) setAction(null); }}>
      <AlertDialogContent className={action?.type === "delete" ? "seller-delete-dialog seller-product-delete-dialog" : action?.type === "deactivate" ? "seller-delete-dialog seller-product-delete-dialog seller-deactivate-dialog" : undefined}>
        <AlertDialogHeader>
          {action?.type === "delete" && <span className="seller-delete-icon"><Trash2 size={25} strokeWidth={1.8} aria-hidden="true" /></span>}
          {action?.type === "deactivate" && <span className="seller-delete-icon"><Ban size={25} strokeWidth={1.8} aria-hidden="true" /></span>}
          <AlertDialogTitle>{t(confirmationCopy.title)}</AlertDialogTitle>
          <AlertDialogDescription>{t(confirmationCopy.description)}</AlertDialogDescription>
        </AlertDialogHeader>
        {actionError && <SellerNotice>{actionError}</SellerNotice>}
        <AlertDialogFooter><AlertDialogCancel disabled={actionBusy}>{t("Cancel")}</AlertDialogCancel><Button variant="destructive" className="seller-button danger" disabled={actionBusy} onClick={() => void confirmProductAction()}>{actionBusy ? t("Please wait…") : t(confirmationCopy.button)}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </SellerPage>;
}
