"use client";

import Link from "next/link";
import { FormEvent, Suspense, use, useRef, useState } from "react";

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

type ChannelView =
  | {
      ok: true;
      title: string;
      description: string;
      bullets: string;
      publications: Publication[];
    }
  | { ok: false; error: string };

const channelCache = new Map<string, Promise<ChannelView>>();

function cacheKey(productId: number, target: ListingTarget, epoch: number) {
  return `${productId}:${listingTargetKey(target)}:${epoch}`;
}

function getChannelView(
  productId: number,
  target: ListingTarget,
  epoch: number,
  failMessage: string,
) {
  const key = cacheKey(productId, target, epoch);
  const cached = channelCache.get(key);
  if (cached) return cached;

  const request = (async (): Promise<ChannelView> => {
    try {
      const [configResponse, publicationResponse] = await Promise.all([
        authorizedFetch(listingConfigPath(productId, target)),
        authorizedFetch(`/api/v1/orchestrator/products/${productId}/publications/`),
      ]);
      if (!configResponse.ok) {
        return {
          ok: false,
          error: apiErrorMessage(await configResponse.json().catch(() => null), failMessage),
        };
      }
      const data = (await configResponse.json()) as ConfigResponse;
      const config = data.configuration || {};
      let publications: Publication[] = [];
      if (publicationResponse.ok) {
        const body = await publicationResponse.json();
        publications = Array.isArray(body) ? body : body.results ?? [];
      }
      return {
        ok: true,
        title: (config.product_line || config.title || "").trim(),
        description: config.description || "",
        bullets: (config.bullet_points || []).join("\n"),
        publications,
      };
    } catch {
      return { ok: false, error: failMessage };
    }
  })();

  channelCache.set(key, request);
  return request;
}

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
  const dirtyRef = useRef(false);

  function selectChannel(target: ListingTarget) {
    if (listingTargetKey(target) === listingTargetKey(channel)) return;
    if (dirtyRef.current && !window.confirm(t("listing.unsaved"))) return;
    setChannel(target);
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
      <Suspense fallback={<p>{t("common.loading")}</p>}>
        <ListingPrepFields
          key={`${listingTargetKey(channel)}-${reloadToken}`}
          productId={productId}
          channel={channel}
          epoch={reloadToken}
          dirtyRef={dirtyRef}
        />
      </Suspense>
      <Link className="listing-open-marketplaces" href="/manager/marketplaces">
        {t("product.openMarketplaces")}
      </Link>
    </section>
  );
}

function ListingPrepFields({
  productId,
  channel,
  epoch,
  dirtyRef,
}: {
  productId: number;
  channel: ListingTarget;
  epoch: number;
  dirtyRef: { current: boolean };
}) {
  const { t } = useI18n();
  const view = use(getChannelView(productId, channel, epoch, t("listing.loadFailed")));
  const [title, setTitle] = useState(view.ok ? view.title : "");
  const [description, setDescription] = useState(view.ok ? view.description : "");
  const [bullets, setBullets] = useState(view.ok ? view.bullets : "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState(view.ok ? "" : view.error);
  const [notice, setNotice] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewOk, setPreviewOk] = useState<boolean | null>(null);
  const publications = view.ok ? view.publications : [];

  function markDirty() {
    setDirty(true);
    dirtyRef.current = true;
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
      channelCache.set(
        cacheKey(productId, channel, epoch),
        Promise.resolve({
          ok: true,
          title: title.trim(),
          description: description.trim(),
          bullets,
          publications,
        }),
      );
      setDirty(false);
      dirtyRef.current = false;
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

  if (!view.ok) {
    return <p className="form-feedback error" role="alert">{error || view.error}</p>;
  }

  return (
    <>
      <form className="listing-prep-form" onSubmit={(event) => void save(event)}>
        <label className="ai-draft-field">
          <span>{channel.marketplace === "otto" ? t("listing.productLine") : t("product.draftTitle")}</span>
          <input value={title} onChange={(event) => { setTitle(event.target.value); markDirty(); }} />
        </label>
        <label className="ai-draft-field">
          <span>{t("product.draftDescription")}</span>
          <textarea rows={7} value={description} onChange={(event) => { setDescription(event.target.value); markDirty(); }} />
        </label>
        {channel.marketplace === "otto" && (
          <label className="ai-draft-field">
            <span>{t("product.draftBullets")}</span>
            <textarea rows={4} value={bullets} onChange={(event) => { setBullets(event.target.value); markDirty(); }} />
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
      {error && <p className="form-feedback error" role="alert">{error}</p>}
      {notice && <p className="form-feedback success">{notice}</p>}
      {previewOk !== null && (
        <div className={`listing-preview ${previewOk ? "is-ok" : "is-bad"}`}>
          <strong>{previewOk ? t("listing.previewOk") : t("listing.previewBad")}</strong>
          <pre>{previewText}</pre>
        </div>
      )}
    </>
  );
}
