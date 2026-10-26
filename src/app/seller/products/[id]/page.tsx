"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, CircleX, Clock3, History, LoaderCircle, Trash2 } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import ProductEditor from "@/components/seller/ProductEditor";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { Button } from "@/components/ui/button";
import SellerModerationHistoryDialog from "@/components/seller/SellerModerationHistoryDialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { sellerRequest, type PageResult, type SellerProduct } from "@/lib/seller";

type Confirmation = "withdraw" | "deactivate" | "archive";
const confirmationCopy: Record<Confirmation, string> = {
  withdraw: "Withdraw this submission from review?",
  deactivate: "Deactivate this product?",
  archive: "Delete this product?",
};

function formatDate(value: string | null | undefined, locale: string) {
  return value ? new Date(value).toLocaleString(locale) : "—";
}

function ProductRejectionReason({ productId }: { productId: number }) {
  const { t } = useSellerI18n();
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setError("");
      try {
        const history = await sellerRequest<PageResult<{ decision: string; comment: string }>>(`/api/v1/products/${productId}/moderation-history/?page=1`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          const latest = history.results[0];
          setReason(latest?.decision === "rejected" ? latest.comment.trim() : "");
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load history.");
      }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [productId, retry]);

  return <div className="seller-rejection-callout" role="status">
    <span className="seller-rejection-icon"><CircleX size={20} strokeWidth={1.8} aria-hidden="true" /></span>
    <div className="seller-rejection-copy"><strong>{t("Reason for rejection")}</strong>
      {error ? <p>{t(error)} <button type="button" className="seller-inline-retry" onClick={() => setRetry(value => value + 1)}>{t("Try again")}</button></p>
        : <p data-seller-translate="skip">{reason === null ? t("Loading history…") : reason || t("No rejection reason provided.")}</p>}
    </div>
  </div>;
}

export default function SellerProductEditorPage() {
  const { t, locale } = useSellerI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const current = await sellerRequest<SellerProduct>(`/api/v1/products/${id}/`, { signal });
      if (!signal?.aborted) { setProduct(current); setEditorVersion(value => value + 1); }
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Could not load product.");
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal);
      if (new URLSearchParams(window.location.search).get("history") === "1") {
        setHistoryOpen(true);
      }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);



  async function confirmAction() {
    if (!confirmation || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (confirmation === "archive") {
        await sellerRequest(`/api/v1/products/${id}/`, { method: "DELETE" });
        router.push("/seller/products");
      } else {
        await sellerRequest(`/api/v1/products/${id}/${confirmation}/`, { method: "POST", body: "{}" });
        await load();
      }
      setConfirmation(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Action failed."));
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  if (!product || product.id !== Number(id)) return <SellerPage title="Edit product">
    {error ? <><SellerNotice>{error}</SellerNotice><Link className="seller-button" href="/seller/products">{t("Back to products")}</Link></> : <SellerLoadingState label={t("Loading product…")} rows={4} />}
  </SellerPage>;

  const canEdit = ["draft", "rejected", "withdrawn", "approved"].includes(product.status);
  const pendingChanges = !!product.pending_changes && Object.keys(product.pending_changes).length > 0;

  return <SellerPage title={product.title} dynamicTitle description="Changes are saved only when you click Save product."
    actions={<button type="button" className="seller-button" onClick={() => setHistoryOpen(true)}><History size={18} aria-hidden="true" />{t("Moderation history")}</button>}>
    {error && <SellerNotice>{error}</SellerNotice>}
    <section className="seller-card seller-editor-status">
      <div className="seller-product-status"><span className={`seller-badge ${product.status}`}>{t(product.status.replaceAll("_", " "))}</span></div>
      {product.status === "rejected" && <ProductRejectionReason key={`${product.id}-${product.updated_at}`} productId={product.id} />}
      {pendingChanges && <div className="seller-pending-callout" role="status"><Clock3 size={19} strokeWidth={1.8} aria-hidden="true" /><div><strong>{t("Changes are waiting for moderation.")}</strong>{product.pending_changes_submitted_at && <span>{t("Submitted")}: {formatDate(product.pending_changes_submitted_at, locale)}</span>}</div></div>}
      {product.status === "submitted" && <p>{t("Withdraw the submission before editing this product.")}</p>}
      <div className="seller-product-actions seller-detail-actions">
        {product.status === "submitted" && <button className="seller-button danger" disabled={busy} onClick={() => setConfirmation("withdraw")}><CircleX size={18} aria-hidden="true" />{t("Withdraw submission")}</button>}
        {product.status === "approved" && !product.deactivated_at && !product.deactivation_requested_at && <button className="seller-button danger" disabled={busy} onClick={() => setConfirmation("deactivate")}><Ban size={18} aria-hidden="true" />{t("Deactivate")}</button>}
        {["draft", "rejected", "withdrawn"].includes(product.status) && <button className="seller-button danger seller-product-delete-button" disabled={busy} onClick={() => setConfirmation("archive")}><Trash2 size={18} aria-hidden="true" />{t("Delete product")}</button>}
      </div>
    </section>
    <ProductEditor key={`${product.id}-${editorVersion}`} product={product} readOnly={!canEdit || busy} onSavingChange={setBusy} />

    <SellerModerationHistoryDialog productId={historyOpen ? Number(id) : null} onClose={() => setHistoryOpen(false)} />
    <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}>
      <AlertDialogContent className={confirmation === "archive" ? "seller-delete-dialog seller-product-delete-dialog" : confirmation === "deactivate" ? "seller-delete-dialog seller-product-delete-dialog seller-deactivate-dialog" : undefined}>
        <AlertDialogHeader>
          {confirmation === "archive" && <span className="seller-delete-icon"><Trash2 size={25} strokeWidth={1.8} aria-hidden="true" /></span>}
          {confirmation === "deactivate" && <span className="seller-delete-icon"><Ban size={25} strokeWidth={1.8} aria-hidden="true" /></span>}
          <AlertDialogTitle>{t(confirmation === "archive" ? "Delete product" : confirmation === "deactivate" ? "Deactivate product" : "Confirm this action")}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation ? t(confirmationCopy[confirmation]) : ""}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("Cancel")}</AlertDialogCancel>
          <Button variant="destructive" className={`seller-button danger seller-product-confirm${confirmation === "archive" ? " seller-delete-confirm" : ""}`} disabled={busy} onClick={() => void confirmAction()}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} aria-hidden="true" />{busy ? t("Please wait…") : t(confirmation === "archive" ? "Delete product" : "Confirm")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </SellerPage>;
}
