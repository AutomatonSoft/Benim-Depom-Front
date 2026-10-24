"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SellerLoadingState, SellerNotice } from "@/components/SellerShell";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { sellerRequest, type PageResult } from "@/lib/seller";

type HistoryRow = {
  id: number;
  decision: string;
  comment: string;
  manager_username: string | null;
  created_at: string;
};

const decisionLabels: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  returned_to_review: "Returned to review",
  withdrawn: "Withdrawn",
};

function HistoryContent({ productId }: { productId: number }) {
  const { t, locale } = useSellerI18n();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<HistoryRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await sellerRequest<PageResult<HistoryRow>>(`/api/v1/products/${productId}/moderation-history/?page=${page}`, { signal: controller.signal });
        if (!controller.signal.aborted) setResult(data);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load history.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [productId, page, retry]);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return <DialogContent className="seller-history-dialog" showCloseButton={false}>
    <DialogHeader className="seller-history-header">
      <DialogTitle>{t("Moderation history")}</DialogTitle>
      <DialogClose asChild><button type="button" className="seller-history-close">{t("Close")}</button></DialogClose>
    </DialogHeader>
    <DialogDescription className="seller-history-description">{t("All approval and rejection decisions for this product, newest first.")}</DialogDescription>
    {!error && result && result.count > 0 && <nav className="seller-history-pagination" aria-label={t("Moderation history")}>
      <button type="button" disabled={loading || !result.previous} onClick={() => { setLoading(true); setPage(value => value - 1); }}>← {t("Previous")}</button>
      <span>{t("Page {page}", { page })}</span>
      <button type="button" disabled={loading || !result.next} onClick={() => { setLoading(true); setPage(value => value + 1); }}>{t("Next")} →</button>
    </nav>}
    {error ? <SellerNotice>{error} <button type="button" className="seller-inline-retry" onClick={() => setRetry(value => value + 1)}>{t("Try again")}</button></SellerNotice> : loading ? <SellerLoadingState label={t("Loading history…")} rows={3} /> : result?.results.length ? <ol className="seller-history-list">
      {result.results.map(row => <li key={row.id}>
        <div className="seller-history-meta">
          <span className={`seller-badge ${row.decision}`}>{t(decisionLabels[row.decision] || row.decision.replaceAll("_", " "))}</span>
          <span className="seller-history-author"><time dateTime={row.created_at}>{dateFormatter.format(new Date(row.created_at))}</time>{row.decision === "withdrawn" ? <> · {t("Seller")}</> : row.manager_username ? <> · <span data-seller-translate="skip">{row.manager_username}</span></> : null}</span>
        </div>
        <p className={row.comment ? undefined : "seller-history-no-comment"} data-seller-translate="skip">{row.decision === "withdrawn" ? t("Submission withdrawn by the seller.") : row.comment || t("No comment.")}</p>
      </li>)}
    </ol> : <p className="seller-empty">{t("No moderation decisions yet.")}</p>}
  </DialogContent>;
}

export default function SellerModerationHistoryDialog({ productId, onClose }: { productId: number | null; onClose: () => void }) {
  return <Dialog open={productId !== null} onOpenChange={open => { if (!open) onClose(); }}>
    {productId !== null && <HistoryContent key={productId} productId={productId} />}
  </Dialog>;
}
