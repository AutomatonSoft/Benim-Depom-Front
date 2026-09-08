"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Feedback, SectionCard, SectionCardHeader } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import {
  ottoCatalogLanguages,
  ottoCatalogPath,
  type OttoCatalogLanguage,
} from "@/lib/listings";
import { cn } from "@/lib/utils";

const CATALOG_LANG_KEY = "benim_otto_catalog_lang";
const relevanceOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

type Group = {
  category_group_id: number;
  category_group: string;
  category_count: number;
};

type Category = {
  category_id: number;
  category_group_id: number;
  name: string;
};

type CatalogAttribute = {
  attribute_id: number;
  name: string;
  type: string;
  attribute_group: string;
  description: string;
  relevance: string;
  multi_value: boolean;
  unit: string;
  unit_display_name: string | null;
  allowed_values: string[];
  allowed_value_labels?: string[];
};

type AttributeValues = Record<string, string | string[]>;
type SheetKind = "group" | "category" | "attribute-pick" | "attribute-value" | null;

function isCatalogLanguage(value: string): value is OttoCatalogLanguage {
  return (ottoCatalogLanguages as readonly string[]).includes(value);
}

function readCatalogLanguage(locale: string): OttoCatalogLanguage {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(CATALOG_LANG_KEY);
    if (stored && isCatalogLanguage(stored)) return stored;
  }
  return locale === "ru" ? "ru" : "en";
}

function toFormValues(source: Record<string, unknown> | undefined): AttributeValues {
  const next: AttributeValues = {};
  for (const [id, value] of Object.entries(source || {})) {
    if (Array.isArray(value)) next[id] = value.map((item) => String(item));
    else if (value != null && String(value).trim()) next[id] = String(value);
  }
  return next;
}

function buildAttributePayload(attributes: CatalogAttribute[], values: AttributeValues) {
  const payload: Record<string, string | number | string[] | number[]> = {};
  for (const attribute of attributes) {
    const id = String(attribute.attribute_id);
    const raw = values[id];
    if (raw == null || raw === "") continue;
    if (attribute.multi_value) {
      const list = (Array.isArray(raw) ? raw : [raw]).map((item) => String(item).trim()).filter(Boolean);
      if (!list.length) continue;
      payload[id] =
        attribute.type === "INTEGER"
          ? list.map((item) => Number.parseInt(item, 10))
          : attribute.type === "FLOAT"
            ? list.map((item) => Number(item))
            : list;
      continue;
    }
    const text = String(Array.isArray(raw) ? raw[0] : raw).trim();
    if (!text) continue;
    payload[id] =
      attribute.type === "INTEGER"
        ? Number.parseInt(text, 10)
        : attribute.type === "FLOAT"
          ? Number(text)
          : text;
  }
  return payload;
}

function formatAttributeValue(attribute: CatalogAttribute, value: string | string[]) {
  const labels = attribute.allowed_value_labels?.length
    ? attribute.allowed_value_labels
    : attribute.allowed_values;
  const list = Array.isArray(value) ? value : value ? [value] : [];
  if (!list.length) return "";
  return list
    .map((item) => {
      const index = attribute.allowed_values.indexOf(item);
      return index >= 0 ? labels[index] || item : item;
    })
    .join(", ");
}

export function OttoCategoryPicker({
  productId,
  categoryName,
  groupName,
  categoryId,
  groupId,
  attributes,
  onSaved,
}: {
  productId: number;
  categoryName: string | null;
  groupName: string | null;
  categoryId: number | null;
  groupId: number | null;
  attributes: Record<string, unknown>;
  onSaved: (next: {
    otto_category_name: string;
    otto_category_group_name: string;
    otto_attributes: Record<string, unknown>;
  }) => void;
}) {
  const { t, locale } = useI18n();
  const [language, setLanguage] = useState<OttoCatalogLanguage>(() => readCatalogLanguage(locale));
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogAttributes, setCatalogAttributes] = useState<CatalogAttribute[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | "">(groupId ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">(categoryId ?? "");
  const [values, setValues] = useState<AttributeValues>(() => toFormValues(attributes));
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [sheetQuery, setSheetQuery] = useState("");
  const [editingAttributeId, setEditingAttributeId] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState<string | string[]>("");
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [missingOverlay, setMissingOverlay] = useState(false);
  const [catalogReady, setCatalogReady] = useState(groupId == null);

  const selectedGroup = groups.find((item) => item.category_group_id === selectedGroupId);
  const selectedCategory = categories.find((item) => item.category_id === selectedCategoryId);
  const displayGroupName = selectedGroup?.category_group || groupName;
  const displayCategoryName = selectedCategory?.name || categoryName;

  const filledAttributes = useMemo(() => {
    return catalogAttributes
      .filter((attribute) => {
        const value = values[String(attribute.attribute_id)];
        if (value == null || value === "") return false;
        return Array.isArray(value) ? value.length > 0 : Boolean(String(value).trim());
      })
      .sort((left, right) => (relevanceOrder[left.relevance] ?? 9) - (relevanceOrder[right.relevance] ?? 9));
  }, [catalogAttributes, values]);

  const pickableAttributes = useMemo(() => {
    const query = sheetQuery.trim().toLocaleLowerCase();
    return catalogAttributes
      .filter((attribute) => {
        if (!query) return true;
        return (
          attribute.name.toLocaleLowerCase().includes(query) ||
          attribute.attribute_group.toLocaleLowerCase().includes(query)
        );
      })
      .sort((left, right) => (relevanceOrder[left.relevance] ?? 9) - (relevanceOrder[right.relevance] ?? 9));
  }, [catalogAttributes, sheetQuery]);

  const filteredGroups = useMemo(() => {
    const query = sheetQuery.trim().toLocaleLowerCase();
    if (!query) return groups;
    return groups.filter((group) => group.category_group.toLocaleLowerCase().includes(query));
  }, [groups, sheetQuery]);

  const filteredCategories = useMemo(() => {
    const query = sheetQuery.trim().toLocaleLowerCase();
    if (!query) return categories;
    return categories.filter((category) => category.name.toLocaleLowerCase().includes(query));
  }, [categories, sheetQuery]);

  async function catalogGet(path: string, currentLanguage: OttoCatalogLanguage, query = "") {
    let response = await authorizedFetch(`${ottoCatalogPath(path, currentLanguage)}${query}`);
    if (!response.ok && currentLanguage !== "de" && response.status === 404) {
      setMissingOverlay(true);
      response = await authorizedFetch(`${ottoCatalogPath(path, "de")}${query}`);
      return response;
    }
    if (response.ok && currentLanguage !== "de") setMissingOverlay(false);
    return response;
  }

  const groupSearchSeq = useRef(0);
  const groupDataSeq = useRef(0);

  async function loadGroups(currentLanguage: OttoCatalogLanguage, search = "") {
    const seq = ++groupSearchSeq.current;
    await Promise.resolve();
    if (seq !== groupSearchSeq.current) return;
    setLoadingSheet(true);
    setError("");
    try {
      const response = await catalogGet(
        "category-groups",
        currentLanguage,
        `?search=${encodeURIComponent(search.trim())}&limit=200`,
      );
      const data = await response.json().catch(() => null);
      if (seq !== groupSearchSeq.current) return;
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.categorySearchFailed")));
      setGroups(Array.isArray(data?.results) ? data.results : []);
    } catch (cause) {
      if (seq !== groupSearchSeq.current) return;
      setError(cause instanceof Error ? cause.message : t("listing.categorySearchFailed"));
    } finally {
      if (seq === groupSearchSeq.current) setLoadingSheet(false);
    }
  }

  async function loadGroupData(nextGroupId: number, currentLanguage: OttoCatalogLanguage) {
    const seq = ++groupDataSeq.current;
    try {
      const [categoryResponse, attributeResponse] = await Promise.all([
        catalogGet(`category-groups/${nextGroupId}/categories`, currentLanguage, "?limit=200"),
        catalogGet(`category-groups/${nextGroupId}/attributes`, currentLanguage),
      ]);
      if (seq !== groupDataSeq.current) return;
      const categoryData = await categoryResponse.json().catch(() => null);
      const attributeData = await attributeResponse.json().catch(() => null);
      if (seq !== groupDataSeq.current) return;
      if (!categoryResponse.ok) {
        throw new Error(apiErrorMessage(categoryData, t("listing.categorySearchFailed")));
      }
      if (!attributeResponse.ok) {
        throw new Error(apiErrorMessage(attributeData, t("listing.categorySearchFailed")));
      }
      setCategories(Array.isArray(categoryData?.results) ? categoryData.results : []);
      setCatalogAttributes(Array.isArray(attributeData) ? attributeData : []);
      setError("");
      setCatalogReady(true);
    } catch (cause) {
      if (seq !== groupDataSeq.current) return;
      setError(cause instanceof Error ? cause.message : t("listing.categorySearchFailed"));
      setCatalogReady(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadGroups(language).catch(() => undefined);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
      groupSearchSeq.current += 1;
    };
    // loadGroups reads latest language/t via closure; intentional language-only refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (selectedGroupId === "") {
        setCategories([]);
        setCatalogAttributes([]);
        setCatalogReady(true);
        return;
      }
      setCatalogReady(false);
      await loadGroupData(Number(selectedGroupId), language);
    })();
    return () => {
      cancelled = true;
      groupDataSeq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, selectedGroupId]);

  useEffect(() => {
    if (!sheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheet]);

  function changeLanguage(next: OttoCatalogLanguage) {
    setLanguage(next);
    window.localStorage.setItem(CATALOG_LANG_KEY, next);
    setNotice("");
    setMissingOverlay(false);
  }

  function openSheet(kind: SheetKind) {
    setSheetQuery("");
    setSheet(kind);
    if (kind === "group") void loadGroups(language, "");
  }

  function closeSheet() {
    setSheet(null);
    setSheetQuery("");
    setEditingAttributeId(null);
    setDraftValue("");
  }

  function selectGroup(group: Group | null) {
    if (!group) {
      setSelectedGroupId("");
      setSelectedCategoryId("");
      setCategories([]);
      setCatalogAttributes([]);
      setValues({});
      closeSheet();
      return;
    }
    if (group.category_group_id !== selectedGroupId) {
      setSelectedCategoryId("");
      setValues({});
    }
    setSelectedGroupId(group.category_group_id);
    closeSheet();
  }

  function selectCategory(category: Category | null) {
    setSelectedCategoryId(category ? category.category_id : "");
    closeSheet();
  }

  function openAttributeValue(attribute: CatalogAttribute) {
    const current = values[String(attribute.attribute_id)];
    setEditingAttributeId(attribute.attribute_id);
    setDraftValue(current ?? (attribute.multi_value ? [] : ""));
    setSheet("attribute-value");
  }

  function commitAttributeValue() {
    if (editingAttributeId == null) return;
    const id = String(editingAttributeId);
    const empty =
      draftValue == null ||
      draftValue === "" ||
      (Array.isArray(draftValue) && draftValue.length === 0);
    setValues((current) => {
      const next = { ...current };
      if (empty) delete next[id];
      else next[id] = draftValue;
      return next;
    });
    closeSheet();
  }

  function removeAttribute(attributeId: number) {
    setValues((current) => {
      const next = { ...current };
      delete next[String(attributeId)];
      return next;
    });
  }

  async function saveCategory() {
    if (selectedGroupId === "" || selectedCategoryId === "") return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otto_category_id: selectedCategoryId,
          otto_category_group_id: selectedGroupId,
          otto_attributes: buildAttributePayload(catalogAttributes, values),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.categorySaveFailed")));
      onSaved({
        otto_category_name: data.otto_category_name,
        otto_category_group_name: data.otto_category_group_name,
        otto_attributes: data.otto_attributes || {},
      });
      setNotice(t("listing.categorySaved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("listing.categorySaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const editingAttribute = catalogAttributes.find((item) => item.attribute_id === editingAttributeId);

  return (
    <SectionCard>
      <SectionCardHeader
        eyebrow={t("listing.ottoCategoryEyebrow")}
        title={t("listing.ottoCategoryTitle")}
        actions={
          <div className="min-w-[140px]">
            <Label htmlFor="otto-catalog-lang" className="mb-1">
              {t("listing.catalogLanguage")}
            </Label>
            <FilterSelect
              id="otto-catalog-lang"
              value={language}
              onChange={(event) => changeLanguage(event.target.value as OttoCatalogLanguage)}
            >
              <option value="ru">{t("listing.langRu")}</option>
              <option value="en">{t("listing.langEn")}</option>
              <option value="tr">{t("listing.langTr")}</option>
              <option value="de">{t("listing.langDe")}</option>
            </FilterSelect>
          </div>
        }
      />
      <div className="grid gap-4 p-4 md:p-5">
        <p className="text-sm font-medium text-muted-foreground">{t("listing.ottoCategoryHint")}</p>
        {missingOverlay ? <Feedback tone="warn">{t("listing.catalogRuPending")}</Feedback> : null}
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-bold",
            displayCategoryName
              ? "border-border bg-[#f8fafc] text-primary"
              : "border-[rgba(247,148,29,0.35)] bg-[var(--ui-warn-bg)] text-[var(--ui-warn)]",
          )}
        >
          {displayCategoryName
            ? `${displayGroupName ? `${displayGroupName} · ` : ""}${displayCategoryName}`
            : t("listing.ottoCategoryMissing")}
        </p>

        <div className="grid gap-3">
          <article className="rounded-xl border border-border bg-card p-3">
            <header className="mb-2 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-secondary text-sm font-bold text-primary" aria-hidden="true">
                ⌂
              </span>
              <strong className="text-sm font-extrabold text-primary">{t("listing.ottoGroupCard")}</strong>
            </header>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-[#f8fafc] px-3 py-2.5 text-left transition-colors hover:border-primary/30"
              onClick={() => openSheet("group")}
            >
              <strong className={cn("text-sm font-extrabold", displayGroupName ? "text-primary" : "text-muted-foreground")}>
                {displayGroupName || t("listing.ottoGroupPlaceholder")}
              </strong>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </article>

          <article className="rounded-xl border border-border bg-card p-3">
            <header className="mb-2 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-secondary text-sm font-bold text-primary" aria-hidden="true">
                ▤
              </span>
              <strong className="text-sm font-extrabold text-primary">{t("listing.ottoCategoryCard")}</strong>
            </header>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-[#f8fafc] px-3 py-2.5 text-left transition-colors hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={selectedGroupId === ""}
              onClick={() => openSheet("category")}
            >
              <strong className={cn("text-sm font-extrabold", displayCategoryName ? "text-primary" : "text-muted-foreground")}>
                {displayCategoryName || t("listing.ottoCategoryPlaceholder")}
              </strong>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </article>

          <article className="rounded-xl border border-border bg-card p-3">
            <header className="mb-2 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-secondary text-sm font-bold text-primary" aria-hidden="true">
                ☰
              </span>
              <strong className="text-sm font-extrabold text-primary">{t("listing.ottoAttributesCard")}</strong>
            </header>
            {filledAttributes.length > 0 ? (
              <ul className="mb-3 grid gap-2">
                {filledAttributes.map((attribute) => (
                  <li key={attribute.attribute_id} className="flex items-stretch gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-xl border border-border bg-[#f8fafc] px-3 py-2 text-left hover:border-primary/30"
                      onClick={() => openAttributeValue(attribute)}
                    >
                      <strong className="truncate text-sm font-extrabold text-primary">{attribute.name}</strong>
                      <span className="truncate text-xs font-semibold text-muted-foreground">
                        {formatAttributeValue(attribute, values[String(attribute.attribute_id)] || "")}
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-[var(--ui-danger)] hover:bg-[var(--ui-danger-bg)]"
                      aria-label={t("listing.removeAttribute")}
                      onClick={() => removeAttribute(attribute.attribute_id)}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={selectedGroupId === "" || !catalogAttributes.length}
              onClick={() => openSheet("attribute-pick")}
            >
              {t("listing.addAttribute")}
            </Button>
          </article>
        </div>

        <Button
          type="button"
          variant="accent"
          className="justify-self-start"
          disabled={saving || !catalogReady || selectedGroupId === "" || selectedCategoryId === ""}
          onClick={() => void saveCategory()}
        >
          {saving ? t("product.saving") : t("listing.saveOttoCategory")}
        </Button>
        {error ? <Feedback>{error}</Feedback> : null}
        {notice ? <Feedback tone="success">{notice}</Feedback> : null}
      </div>

      {sheet ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-[rgba(20,47,85,0.45)] p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
          onClick={closeSheet}
          role="presentation"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-[0_18px_48px_rgba(20,47,85,0.16)] sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t("listing.ottoCategoryTitle")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
            {sheet !== "attribute-value" ? (
              <div className="border-b border-border px-4 py-3">
                <Input
                  autoFocus
                  value={sheetQuery}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSheetQuery(next);
                    if (sheet === "group") void loadGroups(language, next);
                  }}
                  placeholder={
                    sheet === "group"
                      ? t("listing.ottoGroupPlaceholder")
                      : sheet === "category"
                        ? t("listing.ottoCategoryPlaceholder")
                        : t("listing.ottoAttributePlaceholder")
                  }
                />
              </div>
            ) : null}

            <div className="overflow-y-auto p-3">
              {loadingSheet ? <p className="px-2 py-6 text-center text-sm font-semibold text-muted-foreground">{t("common.loading")}</p> : null}

              {sheet === "group" && !loadingSheet ? (
                <div className="grid gap-1">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground hover:bg-secondary"
                    onClick={() => selectGroup(null)}
                  >
                    <span>×</span>
                    {t("listing.selectNone")}
                  </button>
                  {filteredGroups.map((group) => (
                    <button
                      type="button"
                      key={group.category_group_id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-secondary",
                        selectedGroupId === group.category_group_id && "bg-secondary",
                      )}
                      onClick={() => selectGroup(group)}
                    >
                      <strong className="text-sm font-extrabold text-primary">{group.category_group}</strong>
                      <em className="text-xs font-bold not-italic text-muted-foreground">{group.category_count}</em>
                    </button>
                  ))}
                  {!filteredGroups.length ? (
                    <p className="px-2 py-6 text-center text-sm font-semibold text-muted-foreground">{t("listing.sheetEmpty")}</p>
                  ) : null}
                </div>
              ) : null}

              {sheet === "category" ? (
                <div className="grid gap-1">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground hover:bg-secondary"
                    onClick={() => selectCategory(null)}
                  >
                    <span>×</span>
                    {t("listing.selectNone")}
                  </button>
                  {filteredCategories.map((category) => (
                    <button
                      type="button"
                      key={category.category_id}
                      className={cn(
                        "rounded-xl px-3 py-2.5 text-left hover:bg-secondary",
                        selectedCategoryId === category.category_id && "bg-secondary",
                      )}
                      onClick={() => selectCategory(category)}
                    >
                      <strong className="text-sm font-extrabold text-primary">{category.name}</strong>
                    </button>
                  ))}
                  {!filteredCategories.length ? (
                    <p className="px-2 py-6 text-center text-sm font-semibold text-muted-foreground">{t("listing.sheetEmpty")}</p>
                  ) : null}
                </div>
              ) : null}

              {sheet === "attribute-pick" ? (
                <div className="grid gap-1">
                  {pickableAttributes.map((attribute) => (
                    <button
                      type="button"
                      key={attribute.attribute_id}
                      className="flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left hover:bg-secondary"
                      onClick={() => openAttributeValue(attribute)}
                    >
                      <strong className="text-sm font-extrabold text-primary">{attribute.name}</strong>
                      <small className="text-xs font-semibold text-muted-foreground">{attribute.attribute_group}</small>
                    </button>
                  ))}
                  {!pickableAttributes.length ? (
                    <p className="px-2 py-6 text-center text-sm font-semibold text-muted-foreground">{t("listing.sheetEmpty")}</p>
                  ) : null}
                </div>
              ) : null}

              {sheet === "attribute-value" && editingAttribute ? (
                <AttributeValueEditor
                  attribute={editingAttribute}
                  value={draftValue}
                  onChange={setDraftValue}
                  onSave={commitAttributeValue}
                  onCancel={closeSheet}
                  saveLabel={t("common.save")}
                  cancelLabel={t("common.cancel")}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function AttributeValueEditor({
  attribute,
  value,
  onChange,
  onSave,
  onCancel,
  saveLabel,
  cancelLabel,
}: {
  attribute: CatalogAttribute;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  cancelLabel: string;
}) {
  const labels = attribute.allowed_value_labels?.length
    ? attribute.allowed_value_labels
    : attribute.allowed_values;
  const unit = attribute.unit_display_name || attribute.unit;
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <div className="grid gap-3 p-1">
      <header className="grid gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <strong className="text-base font-extrabold text-primary">{attribute.name}</strong>
          {unit ? <em className="text-xs font-bold not-italic text-muted-foreground">{unit}</em> : null}
        </div>
        {attribute.description ? <p className="text-sm text-muted-foreground">{attribute.description}</p> : null}
      </header>
      {attribute.allowed_values.length > 0 && attribute.multi_value ? (
        <div className="grid max-h-[40vh] gap-2 overflow-y-auto">
          {attribute.allowed_values.map((option, index) => {
            const checked = selected.includes(option);
            return (
              <label key={option} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? selected.filter((item) => item !== option) : [...selected, option])
                  }
                />
                {labels[index] || option}
              </label>
            );
          })}
        </div>
      ) : attribute.allowed_values.length > 0 ? (
        <div className="grid max-h-[40vh] gap-1 overflow-y-auto">
          {attribute.allowed_values.map((option, index) => (
            <button
              type="button"
              key={option}
              className={cn(
                "rounded-xl px-3 py-2.5 text-left hover:bg-secondary",
                selected[0] === option && "bg-secondary",
              )}
              onClick={() => onChange(option)}
            >
              <strong className="text-sm font-extrabold text-primary">{labels[index] || option}</strong>
            </button>
          ))}
        </div>
      ) : (
        <Input
          autoFocus
          type={attribute.type === "STRING" ? "text" : "number"}
          step={attribute.type === "FLOAT" ? "any" : "1"}
          value={Array.isArray(value) ? value.join(", ") : value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="accent" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
