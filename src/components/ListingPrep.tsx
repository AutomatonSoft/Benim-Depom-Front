"use client";

import Link from "next/link";
import { FormEvent, Suspense, use, useState } from "react";

import { Feedback, SectionCard, SectionCardHeader } from "@/components/manager/ui";
import { OttoShippingGuide } from "@/components/OttoShippingGuide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import {
  DEFAULT_OTTO_VAT,
  defaultOttoShippingProfileId,
  ensureOttoListingDefaults,
  formatListingErrors,
  listingChannelLabel,
  listingConfigPath,
  listingPreviewPath,
  listingTargetKey,
  listingTargets,
  type Account,
  type ListingTarget,
} from "@/lib/listings";
import { materialPair, materialsPayload } from "@/lib/materials";
import { cn } from "@/lib/utils";

type ConfigResponse = {
  configuration?: {
    product_line?: string;
    title?: string;
    description?: string;
    bullet_points?: string[];
    materials?: string[];
    color?: string;
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
  material1: string;
  material2: string;
  color: string;
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
  sellerMaterials: string;
  sellerColor: string;
};

const bundleCache = new Map<string, Promise<Bundle>>();
function emptyDraft(): ChannelDraft {
  return {
    title: "",
    description: "",
    bullets: "",
    material1: "",
    material2: "",
    color: "",
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
    material1: materialPair(source.materials)[0],
    material2: materialPair(source.materials)[1],
    color: String(source.color || "").trim(),
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
    left.material1 === right.material1 &&
    left.material2 === right.material2 &&
    left.color === right.color &&
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
  await ensureOttoListingDefaults(productId, authorizedFetch);
  const [publicationResponse, jvProfilesResponse, xlProfilesResponse, productResponse, ...configResponses] = await Promise.all([
    authorizedFetch(`/api/v1/orchestrator/products/${productId}/publications/`),
    authorizedFetch("/api/v1/catalog/otto/shipping-profiles/?account=jv"),
    authorizedFetch("/api/v1/catalog/otto/shipping-profiles/?account=xl"),
    authorizedFetch(`/api/v1/products/${productId}/`),
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

  let sellerMaterials = "";
  let sellerColor = "";
  if (productResponse.ok) {
    const product = (await readJson(productResponse)) as {
      variants?: Array<{ materials?: string[]; color?: string }>;
    } | null;
    sellerMaterials = (product?.variants?.[0]?.materials || []).filter(Boolean).join(", ");
    sellerColor = (product?.variants?.[0]?.color || "").trim();
  }

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

  return { publications, profiles, channels, sellerMaterials, sellerColor };
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
    material1: item.material1,
    material2: item.material2,
    color: item.color,
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
    <div className="flex flex-wrap gap-2">
      {listingTargets.map((target) => {
        const active = listingTargetKey(target) === listingTargetKey(channel);
        return (
          <Button
            key={listingTargetKey(target)}
            type="button"
            size="sm"
            variant={active ? "accent" : "secondary"}
            className={cn(!active && "bg-secondary/80")}
            onClick={() => onSelect(target)}
          >
            {listingChannelLabel(target)}
          </Button>
        );
      })}
    </div>
  );
}

export function ListingPrep({
  productId,
  reloadToken = 0,
}: {
  productId: number;
  reloadToken?: number;
}) {
  const { t } = useI18n();
  const [mountId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  return (
    <SectionCard>
      <SectionCardHeader eyebrow={t("listing.eyebrow")} title={t("listing.title")} />
      <div className="grid gap-4 p-4 md:p-5">
        <p className="text-sm font-medium text-muted-foreground">{t("listing.hint")}</p>
        <p className="text-xs font-semibold text-muted-foreground">{t("listing.publishFieldsHint")}</p>
        <div className="grid gap-4">
          <Suspense fallback={<ListingPrepSkeleton />}>
            <ListingPrepFields productId={productId} epoch={`${mountId}:${reloadToken}`} />
          </Suspense>
        </div>
        <Button asChild variant="outline" className="justify-self-start">
          <Link href={`/manager/marketplaces?q=${productId}`}>{t("listing.viewPublications")}</Link>
        </Button>
      </div>
    </SectionCard>
  );
}

function ListingPrepSkeleton() {
  const { t } = useI18n();
  return (
    <>
      <ChannelPills channel={listingTargets[0]} onSelect={() => undefined} />
      <form className="grid gap-4" aria-busy="true">
        <div>
          <Label>{t("listing.productLine")}</Label>
          <Input disabled />
        </div>
        <div>
          <Label>{t("product.draftDescription")}</Label>
          <Textarea disabled rows={7} />
        </div>
        <div>
          <Label>{t("product.draftBullets")}</Label>
          <Textarea disabled rows={4} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("listing.material1")}</Label>
            <Input disabled />
          </div>
          <div>
            <Label>{t("listing.material2")}</Label>
            <Input disabled />
          </div>
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{t("common.loading")}</p>
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
  const profiles = view.profiles[channel.account] || [];
  const defaultShippingId = channel.marketplace === "otto" ? defaultOttoShippingProfileId(profiles) : "";
  const shippingValue =
    channel.marketplace === "otto" ? draft.shippingProfileId || defaultShippingId : draft.shippingProfileId;
  const vatValue = channel.marketplace === "otto" ? draft.vat || DEFAULT_OTTO_VAT : draft.vat;
  const dirty =
    channel.marketplace === "otto"
      ? !draftsEqual({ ...draft, vat: vatValue, shippingProfileId: shippingValue }, baseline)
      : !draftsEqual(draft, baseline);

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
      const title = draft.title.trim();
      if (!title) {
        throw new Error(t("listing.titleRequired"));
      }
      if (title.length > 70) {
        throw new Error(t("listing.titleTooLong"));
      }
      const materials = materialsPayload(draft.material1, draft.material2);
      const color = draft.color.trim();
      const payload =
        channel.marketplace === "otto"
          ? {
              product_line: title,
              description: draft.description.trim(),
              bullet_points: draft.bullets.split("\n").map((item) => item.trim()).filter(Boolean),
              materials,
              color,
              vat: vatValue,
              shipping_profile_id: shippingValue,
            }
          : channel.marketplace === "hood"
            ? {
                title,
                description: draft.description,
                materials,
                color,
              }
            : {
                title,
                description: draft.description.trim(),
                materials,
                color,
              };
      const response = await authorizedFetch(listingConfigPath(productId, channel), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.saveFailed")));
      const next = {
        ...draft,
        title,
        ...(channel.marketplace === "otto"
          ? { vat: vatValue, shippingProfileId: shippingValue }
          : {}),
      };
      setDrafts((current) => ({ ...current, [key]: next }));
      setBaselines((current) => ({ ...current, [key]: next }));
      if (channel.marketplace === "otto") {
        await ensureOttoListingDefaults(productId, authorizedFetch);
      }
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
      await ensureOttoListingDefaults(productId, authorizedFetch);
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
        <Feedback>{loadError}</Feedback>
      </>
    );
  }

  return (
    <>
      <ChannelPills channel={channel} onSelect={selectChannel} />
      <form className="grid gap-4" onSubmit={(event) => void save(event)}>
        <div>
          <Label>{channel.marketplace === "otto" ? t("listing.productLine") : t("product.draftTitle")}</Label>
          <Input
            maxLength={70}
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
          />
          <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
            {t("listing.titleHint", { count: draft.title.trim().length })}
          </p>
        </div>
        <div>
          <Label>{t("listing.color")}</Label>
          <Input value={draft.color} onChange={(event) => updateDraft({ color: event.target.value })} />
          <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
            {view.sellerColor
              ? t("listing.colorHintWithSeller", { color: view.sellerColor })
              : t("listing.colorHint")}
          </p>
        </div>
        <div>
          <Label>{t("product.draftDescription")}</Label>
          <Textarea rows={7} value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("listing.material1")}</Label>
            <Input
              value={draft.material1}
              onChange={(event) => updateDraft({ material1: event.target.value })}
            />
          </div>
          <div>
            <Label>{t("listing.material2")}</Label>
            <Input
              value={draft.material2}
              onChange={(event) => updateDraft({ material2: event.target.value })}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs font-semibold text-muted-foreground">
          {view.sellerMaterials
            ? t("listing.materialsHintWithSeller", { materials: view.sellerMaterials })
            : t("listing.materialsHint")}
        </p>
        <div className={cn(channel.marketplace !== "otto" && "opacity-55")}>
          <Label>{t("product.draftBullets")}</Label>
          <Textarea
            rows={4}
            value={channel.marketplace === "otto" ? draft.bullets : ""}
            disabled={channel.marketplace !== "otto"}
            onChange={(event) => updateDraft({ bullets: event.target.value })}
          />
          {channel.marketplace === "otto" ? (
            <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{t("listing.bulletsHint")}</p>
          ) : null}
        </div>
        {channel.marketplace === "otto" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("listing.ottoVat")}</Label>
              <FilterSelect value={vatValue} onChange={(event) => updateDraft({ vat: event.target.value })}>
                <option value="">{t("listing.selectValue")}</option>
                <option value="FULL">{t("listing.ottoVatFull")}</option>
                <option value="REDUCED">{t("listing.ottoVatReduced")}</option>
                <option value="FREE">{t("listing.ottoVatFree")}</option>
              </FilterSelect>
              <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{t("listing.ottoVatHint")}</p>
            </div>
            <div>
              <Label>{t("listing.ottoShipping")}</Label>
              <FilterSelect
                value={shippingValue}
                onChange={(event) => updateDraft({ shippingProfileId: event.target.value })}
              >
                <option value="">{t("listing.selectValue")}</option>
                {profiles.map((profile) => (
                  <option key={profile.shipping_profile_id} value={profile.shipping_profile_id}>
                    {profile.shipping_profile_name}
                  </option>
                ))}
              </FilterSelect>
              <OttoShippingGuide />
              <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{t("listing.ottoShippingHint")}</p>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="accent" disabled={saving || !dirty}>
            {saving ? t("product.saving") : t("listing.saveChannel")}
          </Button>
          <Button type="button" variant="secondary" disabled={previewing || dirty} onClick={() => void preview()}>
            {previewing ? t("listing.previewing") : t("listing.preview")}
          </Button>
        </div>
        {dirty ? <p className="text-xs font-semibold text-muted-foreground">{t("listing.saveBeforePreview")}</p> : null}
      </form>
      {error ? <Feedback>{error}</Feedback> : null}
      {notice ? <Feedback tone="success">{notice}</Feedback> : null}
      {previewOk !== null ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3",
            previewOk
              ? "border-[rgba(34,140,90,0.28)] bg-[var(--ui-success-bg)]"
              : "border-[rgba(196,64,56,0.28)] bg-[var(--ui-danger-bg)]",
          )}
        >
          <strong className={cn("text-sm font-extrabold", previewOk ? "text-[var(--ui-success)]" : "text-[var(--ui-danger)]")}>
            {previewOk ? t("listing.previewOk") : t("listing.previewBad")}
          </strong>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs font-semibold text-primary">
            {previewText}
          </pre>
        </div>
      ) : null}
    </>
  );
}
