"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw, Shapes, Trash2 } from "lucide-react";
import { ottoCatalogPath, type OttoCatalogLanguage } from "@/lib/listings";
import { loadOttoCatalogPages, parseOttoAttributeValue, type OttoCatalogPage, updateOttoAttribute } from "@/lib/otto-catalog";
import { sellerRequest } from "@/lib/seller";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import { SellerMultiSelect, SellerSearchableSelect } from "@/components/seller/SellerSelect";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<number[]>(() => Object.keys(value.attributes).map(Number).filter(Number.isSafeInteger));
  const [pickerOpen, setPickerOpen] = useState(false);
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
    onChange({ ...value, attributes: updateOttoAttribute(value.attributes, id, next) });
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
    if (isValid) updateAttribute(attribute.attribute_id, attribute.multi_value ? parsed : parsed[0]);
  }

  function changeGroup(group: number | null) {
    setError("");
    setCategories([]);
    setAttributes([]);
    setDrafts({});
    setInvalid([]);
    setSearch("");
    setSelectedAttributeIds([]);
    onChange({ group, category: null, attributes: {} });
  }

  const selectedIds = [...new Set([...selectedAttributeIds, ...Object.keys(value.attributes).filter(key => hasValue(value.attributes[key])).map(Number)])];
  const selectedAttributes = selectedIds
    .map(id => attributes.find(attribute => attribute.attribute_id === id))
    .filter((attribute): attribute is Attribute => attribute !== undefined);

  function removeAttribute(id: number) {
    setSelectedAttributeIds(current => current.filter(currentId => currentId !== id));
    setInvalid(current => current.filter(currentId => currentId !== String(id)));
    setDrafts(current => { const next = { ...current }; delete next[String(id)]; return next; });
    updateAttribute(id, undefined);
  }

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
      </>}
    </label>;
  }

  const categoryPlaceholder = !value.group ? t("Select a category group first") : loadingDetails ? t("Loading…") : t("No category");

  return <SellerLocalized>
    <section className="seller-card seller-otto-card">
      <div className="seller-editor-heading orange"><span className="seller-editor-icon"><Shapes size={20} aria-hidden="true" /></span><h2>{t("Optional OTTO category")}</h2><button type="button" className="seller-button seller-otto-clear" disabled={value.group == null && value.category == null && Object.keys(value.attributes).length === 0} onClick={() => changeGroup(null)}><RotateCcw size={15} aria-hidden="true" />{t("Clear")}</button></div>
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
              placeholder={categoryPlaceholder}
              options={[{ value: "", label: categoryPlaceholder }, ...categories.map(category => ({ value: String(category.category_id), label: category.name }))]}
              onValueChange={selected => onChange({ ...value, category: Number(selected) || null })}
            />
          </label>
        </div>

        {loadingDetails && <p className="seller-field-hint" role="status">{t("Loading catalog attributes…")}</p>}
        {value.group && !value.category && <p className="seller-field-hint">{t("Choose an OTTO category before adding attributes.")}</p>}
        {value.category && <div className="seller-otto-selected">
          <div className="seller-otto-attributes-heading">
            <strong>{t("Added attributes · {count}", { count: selectedAttributes.length })}</strong>
            <button type="button" className="seller-button" disabled={loadingDetails || attributes.length === 0} onClick={() => setPickerOpen(true)}><Plus size={17} aria-hidden="true" />{t("Add attribute")}</button>
          </div>
          {selectedAttributes.length ? selectedAttributes.map(attribute => <div className="seller-otto-selected-attribute" key={attribute.attribute_id}>
            {renderAttribute(attribute)}
            <button type="button" className="seller-icon-button danger" aria-label={`${t("Remove attribute")}: ${attribute.name}`} title={t("Remove attribute")} onClick={() => removeAttribute(attribute.attribute_id)}><Trash2 size={17} aria-hidden="true" /></button>
          </div>) : <p className="seller-field-hint">{t("No attributes selected yet.")}</p>}
          <CommandDialog
            open={pickerOpen}
            onOpenChange={open => { setPickerOpen(open); if (!open) setSearch(""); }}
            title={t("Add attribute")}
            description={t("Search the OTTO catalog and choose an attribute.")}
            className="seller-otto-picker"
          >
            <Command>
              <CommandInput value={search} onValueChange={setSearch} placeholder={t("Search OTTO attributes")} />
              <CommandList>
                <CommandEmpty>{t("No attributes match your search.")}</CommandEmpty>
                <CommandGroup>
                  {attributes.filter(attribute => !selectedAttributes.some(selected => selected.attribute_id === attribute.attribute_id)).map(attribute => <CommandItem
                    key={attribute.attribute_id}
                    value={`${attribute.name} ${attribute.attribute_group}`}
                    onSelect={() => {
                      setSelectedAttributeIds(current => current.includes(attribute.attribute_id) ? current : [...current, attribute.attribute_id]);
                      setPickerOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="seller-otto-option" data-seller-translate="skip"><strong>{attribute.name}</strong>{attribute.attribute_group && <small>{attribute.attribute_group}</small>}</span>
                  </CommandItem>)}
                </CommandGroup>
              </CommandList>
            </Command>
          </CommandDialog>
        </div>}
        {error && <p className="seller-notice seller-notice-error" data-seller-translate="skip">{error}</p>}
      </div>
    </section>
  </SellerLocalized>;
}
