"use client";

import { FormEvent, useState } from "react";

import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";

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

export function OttoCategoryPicker({
  productId,
  categoryName,
  groupName,
  onSaved,
}: {
  productId: number;
  categoryName: string | null;
  groupName: string | null;
  onSaved: (next: { otto_category_name: string; otto_category_group_name: string }) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | "">("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function searchGroups(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError("");
    setNotice("");
    setCategories([]);
    setSelectedGroupId("");
    setSelectedCategoryId("");
    try {
      const response = await authorizedFetch(
        `/api/v1/catalog/otto/category-groups/?search=${encodeURIComponent(query.trim())}&limit=50`,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.categorySearchFailed")));
      setGroups(Array.isArray(data?.results) ? data.results : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("listing.categorySearchFailed"));
    } finally {
      setSearching(false);
    }
  }

  async function loadCategories(groupId: number) {
    setSelectedGroupId(groupId);
    setSelectedCategoryId("");
    setCategories([]);
    setError("");
    try {
      const response = await authorizedFetch(
        `/api/v1/catalog/otto/category-groups/${groupId}/categories/?limit=200`,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.categorySearchFailed")));
      setCategories(Array.isArray(data?.results) ? data.results : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("listing.categorySearchFailed"));
    }
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
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.categorySaveFailed")));
      onSaved({
        otto_category_name: data.otto_category_name,
        otto_category_group_name: data.otto_category_group_name,
      });
      setNotice(t("listing.categorySaved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("listing.categorySaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="workspace-card listing-prep-card">
      <p className="eyebrow">{t("listing.ottoCategoryEyebrow")}</p>
      <h2>{t("listing.ottoCategoryTitle")}</h2>
      <p>{t("listing.ottoCategoryHint")}</p>
      <p className={categoryName ? "listing-category-current" : "listing-category-missing"}>
        {categoryName
          ? `${groupName ? `${groupName} · ` : ""}${categoryName}`
          : t("listing.ottoCategoryMissing")}
      </p>
      <form className="listing-category-search" onSubmit={(event) => void searchGroups(event)}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("listing.ottoCategorySearch")}
        />
        <button className="save-button" type="submit" disabled={searching}>
          {searching ? t("common.loading") : t("common.search")}
        </button>
      </form>
      {groups.length > 0 && (
        <label className="ai-draft-field">
          <span>{t("listing.ottoCategoryGroup")}</span>
          <select
            value={selectedGroupId}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                setSelectedGroupId("");
                setCategories([]);
                return;
              }
              void loadCategories(Number(value));
            }}
          >
            <option value="">{t("listing.selectValue")}</option>
            {groups.map((group) => (
              <option key={group.category_group_id} value={group.category_group_id}>
                {group.category_group}
              </option>
            ))}
          </select>
        </label>
      )}
      {categories.length > 0 && (
        <label className="ai-draft-field">
          <span>{t("listing.ottoCategory")}</span>
          <select
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value ? Number(event.target.value) : "")}
          >
            <option value="">{t("listing.selectValue")}</option>
            {categories.map((category) => (
              <option key={category.category_id} value={category.category_id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="save-button"
        type="button"
        disabled={saving || selectedGroupId === "" || selectedCategoryId === ""}
        onClick={() => void saveCategory()}
      >
        {saving ? t("product.saving") : t("listing.saveOttoCategory")}
      </button>
      {error && <p className="form-feedback error" role="alert">{error}</p>}
      {notice && <p className="form-feedback success">{notice}</p>}
    </section>
  );
}
