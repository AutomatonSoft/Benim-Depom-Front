"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Ban, CircleCheck, CircleX, History, LoaderCircle, Pencil } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import SellerProductImage from "@/components/seller/SellerProductImage";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sellerAllPages, sellerRequest, type PriceNegotiation, type SellerProduct } from "@/lib/seller";

type HistoryRow = {
  id: number;
  decision: string;
  comment: string;
  manager_username: string;
  created_at: string;
};
type Confirmation = "withdraw" | "deactivate" | "archive" | "accept" | "decline";
const confirmationCopy: Record<Confirmation, string> = {
  withdraw: "Withdraw this submission from review?",
  deactivate: "Request that this product is deactivated?",
  archive: "Archive this product? Active marketplace listings must be removed first.",
  accept: "Accept this price offer?",
  decline: "Decline this price offer?",
};

function formatDate(value: string | null | undefined, locale: string) {
  return value ? new Date(value).toLocaleString(locale) : "—";
}

function dimensions(value?: { width_cm: string; height_cm: string; length_cm: string } | null) {
  return value ? `${value.width_cm} × ${value.height_cm} × ${value.length_cm} cm` : "—";
}

export default function SellerProductDetailsPage() {
  const { t, locale } = useSellerI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [offers, setOffers] = useState<PriceNegotiation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [current, moderation, negotiations] = await Promise.all([
        sellerRequest<SellerProduct>(`/api/v1/products/${id}/`),
        sellerAllPages<HistoryRow>(`/api/v1/products/${id}/moderation-history/`),
        sellerAllPages<PriceNegotiation>(`/api/v1/products/${id}/price-negotiations/`),
      ]);
      setProduct(current);
      setHistory(moderation);
      setOffers(negotiations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load product.");
    }
  }, [id]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const chronologicalHistory = useMemo(
    () => [...history].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    [history],
  );
  const chronologicalOffers = useMemo(
    () => [...offers].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    [offers],
  );

  async function action(kind: "withdraw" | "deactivate") {
    setBusy(true);
    setError("");
    try {
      await sellerRequest(`/api/v1/products/${id}/${kind}/`, { method: "POST", body: "{}" });
      await load();
      setConfirmation(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError("");
    try {
      await sellerRequest(`/api/v1/products/${id}/`, { method: "DELETE" });
      setConfirmation(null);
      router.push("/seller/products");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive product.");
    } finally {
      setBusy(false);
    }
  }

  async function respond(accepted: boolean) {
    setBusy(true);
    setError("");
    try {
      await sellerRequest(`/api/v1/products/${id}/price-negotiation/respond/`, {
        method: "POST",
        body: JSON.stringify({ accepted, comment }),
      });
      setComment("");
      await load();
      setConfirmation(null);
      window.dispatchEvent(new Event("seller-notifications-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not respond to the offer.");
    } finally {
      setBusy(false);
    }
  }

  function confirmAction() {
    if (!confirmation) return;
    if (confirmation === "withdraw" || confirmation === "deactivate") void action(confirmation);
    else if (confirmation === "archive") void archive();
    else void respond(confirmation === "accept");
  }

  if (!product) return <SellerPage title="Product details">
    {error ? <><SellerNotice>{error}</SellerNotice><Link className="seller-button" href="/seller/products">{t("Back to products")}</Link></> : <SellerLoadingState label={t("Loading product…")} rows={3} />}
  </SellerPage>;

  const variant = product.variants?.[0];
  const mainFirst = [...(product.images || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const hasPendingChanges = !!product.pending_changes && Object.keys(product.pending_changes).length > 0;
  const canEdit = ["draft", "rejected", "withdrawn", "approved"].includes(product.status);

  return <SellerPage
    title={product.title}
    description={`${product.product_type} · ${product.unit_price} ${product.currency} · ${product.total_quantity} ${t("units")}`}
    dynamicTitle
    dynamicDescription
    actions={<div className="seller-toolbar">
      {canEdit && <Link className="seller-button" href={`/seller/products/${id}/edit`}><Pencil size={18} strokeWidth={1.8} aria-hidden="true" />{t("Edit product")}</Link>}
      <Link className="seller-button" href="#moderation-history"><History size={18} strokeWidth={1.8} aria-hidden="true" />{t("Review history")}</Link>
    </div>}
  >
    {error && <SellerNotice>{error}</SellerNotice>}
    <div className="seller-stack">
      <section className="seller-card">
        <div className="seller-product-status">
          <span className={`seller-badge ${product.status}`}>{t(product.status.replaceAll("_", " "))}</span>
          {product.deactivated_at && <span className="seller-badge deactivated">{t("Deactivated")}</span>}
          {product.last_moderation_decision && <span className="seller-badge">{t("Last review")}: {t(product.last_moderation_decision.replaceAll("_", " "))}</span>}
        </div>
        {hasPendingChanges && <div className="seller-pending-callout" role="status">
          <strong>{t("Changes are waiting for moderation.")}</strong>
          {product.pending_changes_submitted_at && <span>{t("Submitted")}: {formatDate(product.pending_changes_submitted_at, locale)}</span>}
        </div>}
        <div className="seller-product-actions seller-detail-actions">
          {product.status === "submitted" && <button className="seller-button danger" disabled={busy} onClick={() => setConfirmation("withdraw")}><CircleX size={18} strokeWidth={1.8} aria-hidden="true" />{t("Withdraw submission")}</button>}
          {product.status === "approved" && !product.deactivated_at && <button className="seller-button danger" disabled={busy} onClick={() => setConfirmation("deactivate")}><Ban size={18} strokeWidth={1.8} aria-hidden="true" />{t("Request deactivation")}</button>}
          {["draft", "rejected", "withdrawn"].includes(product.status) && <button className="seller-button danger" disabled={busy} onClick={() => setConfirmation("archive")}><Archive size={18} strokeWidth={1.8} aria-hidden="true" />{t("Archive product")}</button>}
        </div>
      </section>

      <section className="seller-card">
        <h2>{t("Product information")}</h2>
        {mainFirst.length > 0 && <div className="seller-picture-grid">{mainFirst.map(image =>
          <SellerProductImage key={image.id} src={image.preview || image.image} alt={image.is_primary ? t("Main product photo") : t("Product photo")} />,
        )}</div>}
        <dl className="seller-definition-grid seller-product-definitions">
          <div><dt>{t("Product type")}</dt><dd data-seller-translate="skip">{product.product_type}</dd></div>
          <div><dt>{t("Unit price")}</dt><dd data-seller-translate="skip">{product.unit_price} {product.currency}</dd></div>
          <div><dt>{t("Total catalogue value")}</dt><dd data-seller-translate="skip">{product.total_amount} {product.currency}</dd></div>
          <div><dt>{t("Warehouse city")}</dt><dd data-seller-translate="skip">{product.warehouse_city}</dd></div>
          <div><dt>{t("Availability")}</dt><dd>{t(product.is_available ? "Available" : "Unavailable")}</dd></div>
          <div><dt>{t("Quantity")}</dt><dd>{product.total_quantity}</dd></div>
          <div><dt>{t("Dimensions")}</dt><dd data-seller-translate="skip">{dimensions(variant)}</dd></div>
          <div><dt>{t("Color")}</dt><dd data-seller-translate="skip">{variant?.color || "—"}</dd></div>
          <div><dt>{t("Materials")}</dt><dd data-seller-translate="skip">{variant?.materials?.join(", ") || "—"}</dd></div>
          <div><dt>{t("Material composition")}</dt><dd data-seller-translate="skip">{variant?.material_composition || "—"}</dd></div>
          <div><dt>{t("Created")}</dt><dd>{formatDate(product.created_at, locale)}</dd></div>
          <div><dt>{t("Last updated")}</dt><dd>{formatDate(product.updated_at, locale)}</dd></div>
        </dl>
        {(product.otto_category_name || product.otto_category_group_name || Object.keys(product.otto_attributes || {}).length > 0) && <div className="seller-product-otto">
          <h3>{t("OTTO catalog information")}</h3>
          {product.otto_category_group_name && <p>{t("Category group")}: <span data-seller-translate="skip">{product.otto_category_group_name}</span></p>}
          {product.otto_category_name && <p>{t("Category")}: <span data-seller-translate="skip">{product.otto_category_name}</span></p>}
          {Object.keys(product.otto_attributes || {}).length > 0 && <dl className="seller-definition-grid">{Object.entries(product.otto_attributes).map(([key, value]) => <div key={key}><dt data-seller-translate="skip">{key}</dt><dd data-seller-translate="skip">{String(value)}</dd></div>)}</dl>}
        </div>}
        {product.set_parts?.length > 0 && <div className="seller-product-set-parts">
          <h3>{t("Set parts")}</h3>
          {product.set_parts.map((part, index) => <p key={part.id ?? index}>
            <strong>{index + 1}. <span data-seller-translate="skip">{part.description}</span></strong>
            <span data-seller-translate="skip"> · {dimensions(part)}</span>
          </p>)}
        </div>}
      </section>

      {product.active_price_negotiation && <section className="seller-card seller-offer-card">
        <h2>{t("Price offer")}</h2>
        <p>{t("Current price")}: <strong data-seller-translate="skip">{product.active_price_negotiation.current_unit_price} {product.active_price_negotiation.currency}</strong></p>
        <p>{t("Proposed price")}: <strong data-seller-translate="skip">{product.active_price_negotiation.proposed_unit_price} {product.active_price_negotiation.currency}</strong></p>
        <p>{t("From")}: <span data-seller-translate="skip">{product.active_price_negotiation.manager_username}</span> · {formatDate(product.active_price_negotiation.created_at, locale)}</p>
        <p className="seller-offer-message" data-seller-translate="skip">{product.active_price_negotiation.message}</p>
        <label className="seller-field">{t("Optional comment")}<textarea value={comment} maxLength={2000} onChange={e => setComment(e.target.value)} /></label>
        <div className="seller-toolbar">
          <button className="seller-button primary" disabled={busy} onClick={() => setConfirmation("accept")}><CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />{t("Accept offer")}</button>
          <button className="seller-button danger" disabled={busy} onClick={() => setConfirmation("decline")}><CircleX size={18} strokeWidth={1.8} aria-hidden="true" />{t("Decline offer")}</button>
        </div>
      </section>}

      <Tabs defaultValue="moderation" className="seller-detail-tabs">
        <TabsList aria-label={t("Product history")} className="seller-detail-tabs-list">
          <TabsTrigger value="moderation">{t("Moderation history")}</TabsTrigger>
          <TabsTrigger value="negotiations">{t("Price negotiation history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="moderation" id="moderation-history" className="seller-card">
          <h2>{t("Moderation history")}</h2>
          {chronologicalHistory.length ? <ol className="seller-timeline">{chronologicalHistory.map((item, index) => <li key={item.id ?? index}>
            <div className="seller-timeline-marker" aria-hidden="true" />
            <div className="seller-timeline-content">
              <div className="seller-timeline-heading"><strong>{t(item.decision.replaceAll("_", " "))}</strong><time dateTime={item.created_at}>{formatDate(item.created_at, locale)}</time></div>
              {item.manager_username && <p>{t("Reviewed by")} <span data-seller-translate="skip">{item.manager_username}</span></p>}
              {item.comment && <p data-seller-translate="skip">{item.comment}</p>}
            </div>
          </li>)}</ol> : <p className="seller-empty">{t("No moderation decisions yet.")}</p>}
        </TabsContent>
        <TabsContent value="negotiations" id="negotiation-history" className="seller-card">
          <h2>{t("Price negotiation history")}</h2>
          {chronologicalOffers.length ? <ol className="seller-timeline">{chronologicalOffers.map(offer => <li key={offer.id}>
            <div className="seller-timeline-marker" aria-hidden="true" />
            <div className="seller-timeline-content">
              <div className="seller-timeline-heading"><strong data-seller-translate="skip">{offer.proposed_unit_price} {offer.currency}</strong><span className={`seller-badge ${offer.status}`}>{t(offer.status.replaceAll("_", " "))}</span></div>
              <p>{t("Current price")}: <span data-seller-translate="skip">{offer.current_unit_price} {offer.currency}</span></p>
              <p data-seller-translate="skip">{offer.message}</p>
              {offer.seller_comment && <p>{t("Your comment")}: <span data-seller-translate="skip">{offer.seller_comment}</span></p>}
              <time dateTime={offer.created_at}>{formatDate(offer.created_at, locale)}</time>
              {offer.responded_at && <small>{t("Responded")}: {formatDate(offer.responded_at, locale)}</small>}
            </div>
          </li>)}</ol> : <p className="seller-empty">{t("No price offers yet.")}</p>}
        </TabsContent>
      </Tabs>
    </div>
    <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Confirm this action")}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation ? t(confirmationCopy[confirmation]) : ""}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("Cancel")}</AlertDialogCancel>
          <Button variant="destructive" className="seller-button danger" disabled={busy} onClick={confirmAction}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />{busy ? t("Please wait…") : t("Confirm")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </SellerPage>;
}
