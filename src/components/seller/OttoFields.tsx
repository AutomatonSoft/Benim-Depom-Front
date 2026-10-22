"use client";

import { useEffect, useState } from "react";
import { ottoCatalogPath, type OttoCatalogLanguage } from "@/lib/listings";
import { loadOttoCatalogPages, parseOttoAttributeValue, type OttoCatalogPage } from "@/lib/otto-catalog";
import { sellerRequest } from "@/lib/seller";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Group = { category_group_id: number; category_group: string };
type Category = { category_id: number; name: string };
type Attribute = {
  attribute_id: number;
  name: string;
  description: string;
  type: string;
  attribute_group: string;
  multi_value: boolean;
  unit: string;
  unit_display_name: string | null;
  allowed_values: unknown[];
  allowed_value_labels: string[];
};

export type OttoValue = {
  group: number | null;
  category: number | null;
  attributes: Record<string, unknown>;
};

export default function OttoFields({ value, onChange }: { value: OttoValue; onChange: (value: OttoValue) => void }) {
  const { t, locale } = useSellerI18n();
  const language: OttoCatalogLanguage = locale;
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setLoadingGroups(true);
      setError("");
      try {
        const result = await loadOttoCatalogPages<Group>(ottoCatalogPath("category-groups", language), url => sellerRequest<OttoCatalogPage<Group>>(url, { signal: controller.signal }));
        if (!controller.signal.aborted) setGroups(result);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load OTTO categories.");
      } finally {
        if (!controller.signal.aborted) setLoadingGroups(false);
      }
    });
    return () => controller.abort();
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (!value.group || controller.signal.aborted) return;
      setCategories([]);
      setAttributes([]);
      setError("");
      setLoadingDetails(true);
      try {
        const [categoryResponse, attributeResponse] = await Promise.all([
          loadOttoCatalogPages<Category>(ottoCatalogPath(`category-groups/${value.group}/categories`, language), url => sellerRequest<OttoCatalogPage<Category>>(url, { signal: controller.signal })),
          sellerRequest<Attribute[]>(ottoCatalogPath(`category-groups/${value.group}/attributes`, language), { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) {
          setCategories(categoryResponse);
          setAttributes(attributeResponse || []);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load category data.");
      } finally {
        if (!controller.signal.aborted) setLoadingDetails(false);
      }
    });
    return () => controller.abort();
  }, [value.group, language]);

  function updateAttribute(id: number, next: unknown) {
    const key = String(id);
    const attributes = { ...value.attributes };
    if (next === undefined || next === "" || (Array.isArray(next) && next.length === 0)) delete attributes[key];
    else attributes[key] = next;
    onChange({ ...value, attributes });
  }

  function updateFreeValue(attribute: Attribute, raw: string) {
    const key = String(attribute.attribute_id);
    setDrafts(current => ({ ...current, [key]: raw }));
    if (!raw.trim()) {
      setInvalid(current => current.filter(id => id !== key));
      updateAttribute(attribute.attribute_id, undefined);
      return;
    }

    const values = attribute.multi_value ? raw.split(/\r?\n/).map(item => item.trim()).filter(Boolean) : [raw.trim()];
    const parsed = values.map(item => parseOttoAttributeValue(attribute.type, item));
    const isValid = parsed.every(item => item !== null);
    setInvalid(current => isValid ? current.filter(id => id !== key) : [...new Set([...current, key])]);
    updateAttribute(attribute.attribute_id, isValid ? attribute.multi_value ? parsed : parsed[0] : undefined);
  }

  function changeGroup(group: number | null) {
    setError("");
    setCategories([]);
    setAttributes([]);
    setDrafts({});
    setInvalid([]);
    onChange({ group, category: null, attributes: {} });
  }

  return <SellerLocalized>
    <section className="seller-card">
      <h2>{t("Optional OTTO category")}</h2>
      <p>{t("Add optional catalog details when they apply to your product.")}</p>
      <div className="seller-form-grid">
        <div className="seller-form-grid seller-otto-selects">
          <label className="seller-field">{t("Category group")}
            <Select value={value.group ?? ""} disabled={loadingGroups} onChange={event => changeGroup(Number(event.target.value) || null)}>
              <option value="">{loadingGroups ? t("Loading…") : t("No category group")}</option>
              {groups.map(group => <option data-seller-translate="skip" key={group.category_group_id} value={group.category_group_id}>{group.category_group}</option>)}
            </Select>
          </label>
          <label className="seller-field">{t("Category")}
            <Select value={value.category ?? ""} disabled={!value.group || loadingDetails} onChange={event => onChange({ ...value, category: Number(event.target.value) || null })}>
              <option value="">{loadingDetails ? t("Loading…") : t("No category")}</option>
              {categories.map(category => <option data-seller-translate="skip" key={category.category_id} value={category.category_id}>{category.name}</option>)}
            </Select>
          </label>
        </div>

        {attributes.length > 0 && <div className="seller-otto-attributes">
          <div className="seller-section-heading">
            <div><h3>{t("Optional attributes")}</h3><p>{t("Choose values from the catalog where they are available.")}</p></div>
            <span className="seller-badge">{attributes.length}</span>
          </div>
          <div className="seller-otto-attribute-grid">
            {attributes.map(attribute => {
              const key = String(attribute.attribute_id);
              const current = value.attributes[key];
              const isInvalid = invalid.includes(key);
              const allowed = attribute.allowed_values || [];
              const unit = attribute.unit_display_name || attribute.unit;
              const savedText = Array.isArray(current) ? current.join(", ") : current == null ? "" : String(current);
              const label = <span data-seller-translate="skip">{attribute.name}{unit ? ` (${unit})` : ""}</span>;
              const description = attribute.description && <small className="seller-field-hint" data-seller-translate="skip">{attribute.description}</small>;

              return <label className="seller-field seller-otto-attribute" key={attribute.attribute_id}>
                {label}
                {description}
                {allowed.length > 0 && (attribute.type === "STRING" || attribute.type === "INTEGER" || attribute.type === "FLOAT") ? <Select
                  multiple={attribute.multi_value}
                  size={attribute.multi_value ? 4 : undefined}
                  value={attribute.multi_value ? (Array.isArray(current) ? current.map(String) : []) : current == null ? "" : String(current)}
                  aria-label={attribute.name}
                  onChange={event => {
                    if (attribute.multi_value) {
                      const selected = Array.from(event.currentTarget.selectedOptions, option => allowed.find(item => String(item) === option.value))
                        .map(item => parseOttoAttributeValue(attribute.type, item)).filter((item): item is string | number => item !== null);
                      updateAttribute(attribute.attribute_id, selected);
                    } else {
                      const raw = allowed.find(item => String(item) === event.currentTarget.value);
                      updateAttribute(attribute.attribute_id, event.currentTarget.value ? parseOttoAttributeValue(attribute.type, raw) ?? undefined : undefined);
                    }
                  }}
                >
                  {!attribute.multi_value && <option value="">{t("Select an option")}</option>}
                  {allowed.map((item, index) => <option data-seller-translate="skip" key={`${key}-${index}`} value={String(item)} disabled={parseOttoAttributeValue(attribute.type, item) === null}>
                    {attribute.allowed_value_labels?.[index] || String(item)}
                  </option>)}
                </Select> : attribute.type === "STRING" || attribute.type === "INTEGER" || attribute.type === "FLOAT" ? <>
                  {attribute.multi_value ? <Textarea
                    rows={3}
                    value={drafts[key] ?? (Array.isArray(current) ? current.join("\n") : "")}
                    placeholder={t("Enter one value per line.")}
                    aria-label={attribute.name}
                    aria-invalid={isInvalid}
                    onChange={event => updateFreeValue(attribute, event.target.value)}
                  /> : <Input
                    type={attribute.type === "STRING" ? "text" : "number"}
                    step={attribute.type === "INTEGER" ? "1" : attribute.type === "FLOAT" ? "any" : undefined}
                    value={drafts[key] ?? savedText}
                    aria-label={attribute.name}
                    aria-invalid={isInvalid}
                    onChange={event => updateFreeValue(attribute, event.target.value)}
                  />}
                  {isInvalid && <small className="seller-field-error">{t("Enter a valid value for this field.")}</small>}
                </> : <>
                  {current !== undefined && <small data-seller-translate="skip">{t("Saved value")}: {savedText}</small>}
                  <small className="seller-field-hint">{t("This optional field uses a format that is not supported here.")}</small>
                  {current !== undefined && <button type="button" className="seller-link-button" onClick={() => updateAttribute(attribute.attribute_id, undefined)}>{t("Remove saved value")}</button>}
                </>}
              </label>;
            })}
          </div>
        </div>}
        {error && <p className="seller-notice seller-notice-error" data-seller-translate="skip">{error}</p>}
      </div>
    </section>
  </SellerLocalized>;
}
