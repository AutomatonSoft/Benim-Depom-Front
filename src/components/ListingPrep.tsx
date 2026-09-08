"use client";

import Link from "next/link";
import { FormEvent, Suspense, use, useState } from "react";

import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import {
  formatListingErrors,
  listingChannelLabel,
  listingConfigPath,
  listingPreviewPath,
  listingTargetKey,
  listingTargets,
  type Account,
  type ListingTarget,
} from "@/lib/listings";

type ConfigResponse = {
  configuration?: {
    product_line?: string;
    title?: string;
    description?: string;
    bullet_points?: string[];
    vat?: string;
    shipping_profile_id?: string;
    category_id?: string;
    delivery?: number | string;
  };
};

type Publication = { marketplace: string; account: string; status: string };

type ShippingProfile = {
  shipping_profile_id: string;
  shipping_profile_name: string;
};

type ChannelDraft = {
  title: string;
  description: string;
  bullets: string;
  vat: string;
  shippingProfileId: string;
  hoodCategoryId: string;
  delivery: string;
};

type ChannelRecord = ChannelDraft & { error?: string };

type Bundle = {
  publications: Publication[];
  profiles: Record<Account, ShippingProfile[]>;
  channels: Record<string, ChannelRecord>;
};

const bundleCache = new Map<string, Promise<Bundle>>();
function emptyDraft(): ChannelDraft {
  return {
    title: "",
    description: "",
    bullets: "",
    vat: "",
    shippingProfileId: "",
    hoodCategoryId: "",
    delivery: "",
  };
}

function draftFromConfig(config: ConfigResponse["configuration"]): ChannelDraft {
  const source = config || {};
  return {
    title: (source.product_line || source.title || "").trim(),
    description: source.description || "",
    bullets: (source.bullet_points || []).join("\n"),
    vat: String(source.vat || "").trim(),
    shippingProfileId: String(source.shipping_profile_id || "").trim(),
    hoodCategoryId: String(source.category_id || "").trim(),
    delivery: source.delivery == null || source.delivery === "" ? "" : String(source.delivery),
  };
}

function draftsEqual(left: ChannelDraft, right: ChannelDraft) {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.bullets === right.bullets &&
    left.vat === right.vat &&
    left.shippingProfileId === right.shippingProfileId &&
    left.hoodCategoryId === right.hoodCategoryId &&
    left.delivery === right.delivery
  );
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

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

async function loadBundle(productId: number, failMessage: string): Promise<Bundle> {
  const [publicationResponse, jvProfilesResponse, xlProfilesResponse, ...configResponses] = await Promise.all([
    authorizedFetch(`/api/v1/orchestrator/products/${productId}/publications/`),
    authorizedFetch("/api/v1/catalog/otto/shipping-profiles/?account=jv"),
    authorizedFetch("/api/v1/catalog/otto/shipping-profiles/?account=xl"),
    ...listingTargets.map((target) => authorizedFetch(listingConfigPath(productId, target))),
  ]);

  let publications: Publication[] = [];
  if (publicationResponse.ok) {
    const body = await readJson(publicationResponse);
    publications = Array.isArray(body) ? body : body?.results ?? [];
  }

  const profiles = {
    jv: jvProfilesResponse.ok ? ((await readJson(jvProfilesResponse)) as ShippingProfile[]) || [] : [],
    xl: xlProfilesResponse.ok ? ((await readJson(xlProfilesResponse)) as ShippingProfile[]) || [] : [],
  };

  const channels: Record<string, ChannelRecord> = {};
  await Promise.all(
    listingTargets.map(async (target, index) => {
      const key = listingTargetKey(target);
      const response = configResponses[index];
      if (!response.ok) {
        channels[key] = {
          ...emptyDraft(),
          error: apiErrorMessage(await readJson(response), failMessage),
        };
        return;
      }
      const data = (await readJson(response)) as ConfigResponse | null;
      channels[key] = draftFromConfig(data?.configuration);
    }),
  );

  return { publications, profiles, channels };
}

function getBundle(productId: number, epoch: string, failMessage: string) {
  const key = `${productId}:${epoch}`;
  const cached = bundleCache.get(key);
  if (cached) return cached;
  const request = loadBundle(productId, failMessage);
  bundleCache.set(key, request);
  return request;
}

function toDraft(item: ChannelRecord | ChannelDraft): ChannelDraft {
  return {
    title: item.title,
    description: item.description,
    bullets: item.bullets,
    vat: item.vat,
    shippingProfileId: item.shippingProfileId,
    hoodCategoryId: item.hoodCategoryId,
    delivery: item.delivery,
  };
}

function ChannelPills({
  channel,
  onSelect,
}: {
  channel: ListingTarget;
  onSelect: (target: ListingTarget) => void;
}) {
  return (
    <div className="listing-channel-pills">
      {listingTargets.map((target) => (
        <button
          key={listingTargetKey(target)}
          type="button"
          className={listingTargetKey(target) === listingTargetKey(channel) ? "is-active" : ""}
          onClick={() => onSelect(target)}
        >
          {listingChannelLabel(target)}
        </button>
      ))}
    </div>
  );
}

export function ListingPrep({
  productId,
  reloadToken = 0,
  publishHref = "/manager/marketplaces",
}: {
  productId: number;
  reloadToken?: number;
  publishHref?: string;
}) {
  const { t } = useI18n();
  const [mountId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  return (
    <section className="workspace-card listing-prep-card">
      <p className="eyebrow">{t("listing.eyebrow")}</p>
      <h2>{t("listing.title")}</h2>
      <p>{t("listing.hint")}</p>
      <p className="ai-draft-hint">{t("listing.publishFieldsHint")}</p>
      <div className="listing-prep-stage">
        <Suspense fallback={<ListingPrepSkeleton />}>
          <ListingPrepFields productId={productId} epoch={`${mountId}:${reloadToken}`} />
        </Suspense>
      </div>
      <Link className="listing-open-marketplaces" href={publishHref}>
        {t("product.openMarketplaces")}
      </Link>
    </section>
  );
}

function ListingPrepSkeleton() {
  const { t } = useI18n();
  return (
    <>
      <ChannelPills channel={listingTargets[0]} onSelect={() => undefined} />
      <form className="listing-prep-form" aria-busy="true">
        <label className="ai-draft-field">
          <span>{t("listing.productLine")}</span>
          <input disabled />
        </label>
        <label className="ai-draft-field">
          <span>{t("product.draftDescription")}</span>
          <textarea disabled rows={7} />
        </label>
        <label className="ai-draft-field">
          <span>{t("product.draftBullets")}</span>
          <textarea disabled rows={4} />
        </label>
        <div className="listing-channel-fields" />
        <p>{t("common.loading")}</p>
      </form>
    </>
  );
}

function ListingPrepFields({
  productId,
  epoch,
}: {
  productId: number;
  epoch: string;
}) {
  const { t } = useI18n();
  const view = use(getBundle(productId, epoch, t("listing.loadFailed")));
  const [channel, setChannel] = useState<ListingTarget>(listingTargets[0]);
  const key = listingTargetKey(channel);
  const loadError = view.channels[key]?.error || "";
  const [baselines, setBaselines] = useState<Record<string, ChannelDraft>>(() =>
    Object.fromEntries(listingTargets.map((target) => [listingTargetKey(target), toDraft(view.channels[listingTargetKey(target)] || emptyDraft())])),
  );
  const [drafts, setDrafts] = useState<Record<string, ChannelDraft>>(() => ({ ...baselines }));
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState(loadError);
  const [notice, setNotice] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewOk, setPreviewOk] = useState<boolean | null>(null);

  const draft = drafts[key] || emptyDraft();
  const baseline = baselines[key] || emptyDraft();
  const dirty = !draftsEqual(draft, baseline);

  function selectChannel(target: ListingTarget) {
    if (listingTargetKey(target) === listingTargetKey(channel)) return;
    if (dirty && !window.confirm(t("listing.unsaved"))) return;
    setChannel(target);
    setError(view.channels[listingTargetKey(target)]?.error || "");
    setNotice("");
    setPreviewOk(null);
    setPreviewText("");
  }

  function updateDraft(patch: Partial<ChannelDraft>) {
    setDrafts((current) => ({ ...current, [key]: { ...draft, ...patch } }));
    setNotice("");
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
              product_line: draft.title.trim(),
              description: draft.description.trim(),
              bullet_points: draft.bullets.split("\n").map((item) => item.trim()).filter(Boolean),
              ...(draft.vat ? { vat: draft.vat } : {}),
              shipping_profile_id: draft.shippingProfileId,
            }
          : channel.marketplace === "hood"
            ? {
                title: draft.title.trim(),
                description: draft.description,
                category_id: draft.hoodCategoryId.trim(),
              }
            : {
                title: draft.title.trim(),
                description: draft.description.trim(),
                ...(Number.isFinite(Number(draft.delivery)) && draft.delivery.trim() !== ""
                  ? { delivery: Number(draft.delivery) }
                  : {}),
              };
      const response = await authorizedFetch(listingConfigPath(productId, channel), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.saveFailed")));
      const next = { ...draft, title: draft.title.trim() };
      setDrafts((current) => ({ ...current, [key]: next }));
      setBaselines((current) => ({ ...current, [key]: next }));
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
        kauflandMode(view.publications, channel.account),
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

  if (loadError) {
    return (
      <>
        <ChannelPills channel={channel} onSelect={selectChannel} />
        <p className="form-feedback error" role="alert">{loadError}</p>
      </>
    );
  }

  const profiles = view.profiles[channel.account] || [];

  return (
    <>
      <ChannelPills channel={channel} onSelect={selectChannel} />
      <form className="listing-prep-form" onSubmit={(event) => void save(event)}>
        <label className="ai-draft-field">
          <span>{channel.marketplace === "otto" ? t("listing.productLine") : t("product.draftTitle")}</span>
          <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
        </label>
        <label className="ai-draft-field">
          <span>{t("product.draftDescription")}</span>
          <textarea rows={7} value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} />
        </label>
        <label className={`ai-draft-field${channel.marketplace === "otto" ? "" : " is-reserved"}`}>
          <span>{t("product.draftBullets")}</span>
          <textarea
            rows={4}
            value={channel.marketplace === "otto" ? draft.bullets : ""}
            disabled={channel.marketplace !== "otto"}
            onChange={(event) => updateDraft({ bullets: event.target.value })}
          />
        </label>
        <div className="listing-channel-fields">
          {channel.marketplace === "otto" ? (
            <>
              <label className="ai-draft-field">
                <span>{t("listing.ottoVat")}</span>
                <select value={draft.vat} onChange={(event) => updateDraft({ vat: event.target.value })}>
                  <option value="">{t("listing.selectValue")}</option>
                  <option value="FULL">{t("listing.ottoVatFull")}</option>
                  <option value="REDUCED">{t("listing.ottoVatReduced")}</option>
                  <option value="FREE">{t("listing.ottoVatFree")}</option>
                </select>
                <small className="ai-draft-hint">{t("listing.ottoVatHint")}</small>
              </label>
              <label className="ai-draft-field">
                <span>{t("listing.ottoShipping")}</span>
                <select
                  value={draft.shippingProfileId}
                  onChange={(event) => updateDraft({ shippingProfileId: event.target.value })}
                >
                  <option value="">{t("listing.selectValue")}</option>
                  {profiles.map((profile) => (
                    <option key={profile.shipping_profile_id} value={profile.shipping_profile_id}>
                      {profile.shipping_profile_name}
                    </option>
                  ))}
                </select>
                <small className="ai-draft-hint">{t("listing.ottoShippingHint")}</small>
              </label>
            </>
          ) : null}
          {channel.marketplace === "hood" ? (
            <label className="ai-draft-field">
              <span>{t("listing.hoodCategory")}</span>
              <input
                value={draft.hoodCategoryId}
                onChange={(event) => updateDraft({ hoodCategoryId: event.target.value })}
              />
              <small className="ai-draft-hint">{t("listing.hoodCategoryHint")}</small>
            </label>
          ) : null}
          {channel.marketplace === "kaufland" ? (
            <label className="ai-draft-field">
              <span>{t("listing.kauflandDelivery")}</span>
              <input
                inputMode="numeric"
                min={0}
                type="number"
                value={draft.delivery}
                onChange={(event) => updateDraft({ delivery: event.target.value })}
              />
              <small className="ai-draft-hint">{t("listing.kauflandDeliveryHint")}</small>
            </label>
          ) : null}
        </div>
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
