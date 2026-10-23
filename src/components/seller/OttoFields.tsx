"use client";

import { useEffect, useState } from "react";
import { Accordion } from "radix-ui";
import { ChevronDown, Search, Shapes } from "lucide-react";
import { ottoCatalogPath, type OttoCatalogLanguage } from "@/lib/listings";
import { loadOttoCatalogPages, parseOttoAttributeValue, type OttoCatalogPage } from "@/lib/otto-catalog";
import { sellerRequest } from "@/lib/seller";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import { SellerMultiSelect, SellerSearchableSelect } from "@/components/seller/SellerSelect";
import { Input } from "@/components/ui/input";
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

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

export default function OttoFields({ value, onChange }: { value: OttoValue; onChange: (value: OttoValue) => void }) {
  const { t, locale } = useSellerI18n();
  const language: OttoCatalogLanguage = locale;
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
    const nextAttributes = { ...value.attributes };
    if (!hasValue(next)) delete nextAttributes[key];
    else nextAttributes[key] = next;
    onChange({ ...value, attributes: nextAttributes });
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
    setSearch("");
    setOpenGroups([]);
    setAdvancedOpen(false);
    onChange({ group, category: null, attributes: {} });
  }

  const grouped = new Map<string, Attribute[]>();
  for (const attribute of attributes) {
    const name = attribute.attribute_group?.trim() || t("Other");
    grouped.set(name, [...(grouped.get(name) || []), attribute]);
  }
  const needle = search.trim().toLocaleLowerCase(locale);
  const visibleGroups = [...grouped.entries()].map(([name, fields]) => [name, fields.filter(attribute =>
    !needle || invalid.includes(String(attribute.attribute_id)) || [attribute.name, attribute.description, name].some(text => text.toLocaleLowerCase(locale).includes(needle)),
  )] as const).filter(([, fields]) => fields.length > 0);
  const filledAttributes = attributes.filter(attribute => hasValue(value.attributes[String(attribute.attribute_id)]));
  const errorsPresent = invalid.length > 0;

  const invalidGroups = [...grouped.entries()].filter(([, fields]) => fields.some(attribute => invalid.includes(String(attribute.attribute_id)))).map(([name]) => name);
  const searchGroups = needle ? visibleGroups.map(([name]) => name) : [];
  const expandedGroups = [...new Set([...openGroups, ...invalidGroups, ...searchGroups])];

  function renderAttribute(attribute: Attribute) {
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
      {allowed.length > 0 && (attribute.type === "STRING" || attribute.type === "INTEGER" || attribute.type === "FLOAT") ? attribute.multi_value ? <SellerMultiSelect
        ariaLabel={attribute.name}
        placeholder={t("Select values")}
        value={Array.isArray(current) ? current.map(String) : []}
        options={allowed.map((item, index) => ({ value: String(item), label: attribute.allowed_value_labels?.[index] || String(item) }))}
        onValueChange={selected => {
          const parsed = selected.map(selectedValue => allowed.find(item => String(item) === selectedValue))
            .map(item => parseOttoAttributeValue(attribute.type, item)).filter((item): item is string | number => item !== null);
          updateAttribute(attribute.attribute_id, parsed);
        }}
      /> : <SellerSearchableSelect
        ariaLabel={attribute.name}
        placeholder={t("Select an option")}
        value={current == null ? "" : String(current)}
        options={[
          { value: "", label: t("Select an option") },
          ...allowed.map((item, index) => ({ value: String(item), label: attribute.allowed_value_labels?.[index] || String(item), disabled: parseOttoAttributeValue(attribute.type, item) === null })),
        ]}
        onValueChange={selected => {
          const raw = allowed.find(item => String(item) === selected);
          updateAttribute(attribute.attribute_id, selected ? parseOttoAttributeValue(attribute.type, raw) ?? undefined : undefined);
        }}
      /> : attribute.type === "STRING" || attribute.type === "INTEGER" || attribute.type === "FLOAT" ? <>
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
  }

  return <SellerLocalized>
    <section className="seller-card seller-otto-card">
      <div className="seller-editor-heading orange"><span className="seller-editor-icon"><Shapes size={20} aria-hidden="true" /></span><h2>{t("Optional OTTO category")}</h2></div>
      <p>{t("Add optional catalog details when they apply to your product.")}</p>
      <div className="seller-form-grid">
        <div className="seller-form-grid seller-otto-selects">
          <label className="seller-field">{t("Category group")}
            <SellerSearchableSelect
              value={value.group == null ? "" : String(value.group)}
              disabled={loadingGroups}
              placeholder={loadingGroups ? t("Loading…") : t("No category group")}
              options={[{ value: "", label: loadingGroups ? t("Loading…") : t("No category group") }, ...groups.map(group => ({ value: String(group.category_group_id), label: group.category_group }))]}
              onValueChange={selected => changeGroup(Number(selected) || null)}
            />
          </label>
          <label className="seller-field">{t("Category")}
            <SellerSearchableSelect
              value={value.category == null ? "" : String(value.category)}
              disabled={!value.group || loadingDetails}
              placeholder={loadingDetails ? t("Loading…") : t("No category")}
              options={[{ value: "", label: loadingDetails ? t("Loading…") : t("No category") }, ...categories.map(category => ({ value: String(category.category_id), label: category.name }))]}
              onValueChange={selected => onChange({ ...value, category: Number(selected) || null })}
            />
          </label>
        </div>

        {loadingDetails && <p className="seller-field-hint" role="status">{t("Loading catalog attributes…")}</p>}
        {attributes.length > 0 && <details className="seller-otto-advanced" open={advancedOpen || errorsPresent} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
          <summary className="seller-otto-summary">
            <span><strong>{t("Optional attributes · {count}", { count: attributes.length })}</strong><small>{t("{count} filled", { count: filledAttributes.length })}{errorsPresent ? ` · ${t("{count} needs attention", { count: invalid.length })}` : ""}</small></span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="seller-otto-expanded">
            <label className="seller-otto-search">
              <Search size={17} aria-hidden="true" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Search attributes")} aria-label={t("Search attributes")} />
            </label>
            {filledAttributes.length > 0 && <div className="seller-otto-filled" aria-label={t("Filled attributes")}>
              {filledAttributes.slice(0, 4).map(attribute => <span key={attribute.attribute_id} data-seller-translate="skip">{attribute.name}</span>)}
              {filledAttributes.length > 4 && <span>{t("+{count} more", { count: filledAttributes.length - 4 })}</span>}
            </div>}
            {visibleGroups.length ? <Accordion.Root type="multiple" value={expandedGroups} onValueChange={setOpenGroups} className="seller-otto-accordion">
              {visibleGroups.map(([name, fields]) => {
                const filledCount = fields.filter(attribute => hasValue(value.attributes[String(attribute.attribute_id)])).length;
                return <Accordion.Item key={name} value={name} className="seller-otto-group">
                  <Accordion.Header className="seller-otto-group-heading">
                    <Accordion.Trigger className="seller-otto-group-trigger"><span>{name}<small>{filledCount}/{fields.length} · {t("attributes")}</small></span><ChevronDown size={17} aria-hidden="true" /></Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="seller-otto-group-content"><div className="seller-otto-attribute-grid">{fields.map(renderAttribute)}</div></Accordion.Content>
                </Accordion.Item>;
              })}
            </Accordion.Root> : <p className="seller-field-hint">{t("No attributes match your search.")}</p>}
          </div>
        </details>}
        {error && <p className="seller-notice seller-notice-error" data-seller-translate="skip">{error}</p>}
      </div>
    </section>
  </SellerLocalized>;
}
