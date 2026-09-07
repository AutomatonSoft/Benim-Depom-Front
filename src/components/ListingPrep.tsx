"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import {
  formatListingErrors,
  listingConfigPath,
  listingPreviewPath,
  listingTargetKey,
  listingTargets,
  marketplaceName,
  type Account,
  type ListingTarget,
} from "@/lib/listings";

type ConfigResponse = {
  configuration?: {
    product_line?: string;
    title?: string;
    description?: string;
    bullet_points?: string[];
  };
};

type Publication = { marketplace: string; account: string; status: string };

function kauflandMode(publications: Publication[], account: Account): "create" | "update" {
  const live = publications.some(
    (item) =>
      item.marketplace === "kaufland" &&
      item.account === account &&
      item.status !== "deleted" &&
      item.status !== "failed",
  );
  return live ? "update" : "create";
}

export function ListingPrep({ productId, reloadToken = 0 }: { productId: number; reloadToken?: number }) {
  const { t } = useI18n();
  const [channel, setChannel] = useState<ListingTarget>(listingTargets[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bullets, setBullets] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewOk, setPreviewOk] = useState<boolean | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);

  const loadChannel = useCallback(
    async (target: ListingTarget) => {
      setLoading(true);
      setError("");
      setNotice("");
      setPreviewText("");
      setPreviewOk(null);
      try {
        const [configResponse, publicationResponse] = await Promise.all([
          authorizedFetch(listingConfigPath(productId, target)),
          authorizedFetch(`/api/v1/orchestrator/products/${productId}/publications/`),
        ]);
        if (!configResponse.ok) {
          throw new Error(apiErrorMessage(await configResponse.json().catch(() => null), t("listing.loadFailed")));
        }
        const data = (await configResponse.json()) as ConfigResponse;
        const config = data.configuration || {};
        setTitle((config.product_line || config.title || "").trim());
        setDescription(config.description || "");
        setBullets((config.bullet_points || []).join("\n"));
        setDirty(false);
        if (publicationResponse.ok) {
          const body = await publicationResponse.json();
          setPublications(Array.isArray(body) ? body : body.results ?? []);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t("listing.loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [productId, t],
  );

  useEffect(() => {
    void loadChannel(channel);
  }, [channel, loadChannel, reloadToken]);

  function selectChannel(target: ListingTarget) {
    if (dirty && !window.confirm(t("listing.unsaved"))) return;
    setChannel(target);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload =
        channel.marketplace === "otto"
          ? {
              product_line: title.trim(),
              description: description.trim(),
              bullet_points: bullets.split("\n").map((item) => item.trim()).filter(Boolean),
            }
          : { title: title.trim(), description: description.trim() };
      const response = await authorizedFetch(listingConfigPath(productId, channel), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.saveFailed")));
      setDirty(false);
      setNotice(t("listing.saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("listing.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    setPreviewing(true);
    setError("");
    setNotice("");
    try {
      const path = listingPreviewPath(
        productId,
        channel,
        kauflandMode(publications, channel.account),
      );
      const response = await authorizedFetch(path);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setPreviewOk(false);
        setPreviewText(
          formatListingErrors(data?.errors) || apiErrorMessage(data, t("listing.previewNotReady")),
        );
        return;
      }
      setPreviewOk(true);
      setPreviewText(JSON.stringify(data?.payload ?? data, null, 2));
    } catch {
      setPreviewOk(false);
      setPreviewText(t("common.apiUnreachable"));
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <section className="workspace-card listing-prep-card">
      <p className="eyebrow">{t("listing.eyebrow")}</p>
      <h2>{t("listing.title")}</h2>
      <p>{t("listing.hint")}</p>
      <div className="listing-channel-pills">
        {listingTargets.map((target) => (
          <button
            key={listingTargetKey(target)}
            type="button"
            className={listingTargetKey(target) === listingTargetKey(channel) ? "is-active" : ""}
            onClick={() => selectChannel(target)}
          >
            {marketplaceName[target.marketplace]} {target.account.toUpperCase()}
          </button>
        ))}
      </div>
      {loading ? (
        <p>{t("common.loading")}</p>
      ) : (
        <form className="listing-prep-form" onSubmit={(event) => void save(event)}>
          <label className="ai-draft-field">
            <span>{channel.marketplace === "otto" ? t("listing.productLine") : t("product.draftTitle")}</span>
            <input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} />
          </label>
          <label className="ai-draft-field">
            <span>{t("product.draftDescription")}</span>
            <textarea rows={7} value={description} onChange={(event) => { setDescription(event.target.value); setDirty(true); }} />
          </label>
          {channel.marketplace === "otto" && (
            <label className="ai-draft-field">
              <span>{t("product.draftBullets")}</span>
              <textarea rows={4} value={bullets} onChange={(event) => { setBullets(event.target.value); setDirty(true); }} />
            </label>
          )}
          <div className="listing-prep-actions">
            <button className="save-button" type="submit" disabled={saving || !dirty}>
              {saving ? t("product.saving") : t("listing.saveChannel")}
            </button>
            <button type="button" className="listing-preview-button" disabled={previewing || dirty} onClick={() => void preview()}>
              {previewing ? t("listing.previewing") : t("listing.preview")}
            </button>
          </div>
          {dirty && <small className="ai-draft-hint">{t("listing.saveBeforePreview")}</small>}
        </form>
      )}
      {error && <p className="form-feedback error" role="alert">{error}</p>}
      {notice && <p className="form-feedback success">{notice}</p>}
      {previewOk !== null && (
        <div className={`listing-preview ${previewOk ? "is-ok" : "is-bad"}`}>
          <strong>{previewOk ? t("listing.previewOk") : t("listing.previewBad")}</strong>
          <pre>{previewText}</pre>
        </div>
      )}
      <Link className="listing-open-marketplaces" href="/manager/marketplaces">
        {t("product.openMarketplaces")}
      </Link>
    </section>
  );
}
