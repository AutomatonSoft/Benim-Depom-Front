"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, use, useState } from "react";

import { ListingPrep } from "@/components/ListingPrep";
import { OttoCategoryPicker } from "@/components/OttoCategoryPicker";
import { useI18n } from "@/i18n";
import { authorizedFetch } from "@/lib/api";

type ProductSummary = {
  id: number;
  title: string;
  otto_category_name: string | null;
  otto_category_group_name: string | null;
};

const productCache = new Map<number, Promise<ProductSummary | "unauthorized" | "missing">>();

function getProduct(productId: number) {
  const cached = productCache.get(productId);
  if (cached) return cached;
  const request = authorizedFetch(`/api/v1/products/${productId}/`).then(async (response) => {
    if (response.status === 401) return "unauthorized" as const;
    if (response.status === 404) return "missing" as const;
    if (!response.ok) throw new Error("failed");
    return (await response.json()) as ProductSummary;
  });
  productCache.set(productId, request);
  return request;
}

export default function ProductListingsPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    return (
      <section className="content products-page">
        <p className="products-message">{t("product.notFound")}</p>
      </section>
    );
  }

  return (
    <Suspense fallback={<section className="content products-page"><p className="products-message">{t("common.loading")}</p></section>}>
      <ListingsLoaded productId={productId} />
    </Suspense>
  );
}

function ListingsLoaded({ productId }: { productId: number }) {
  const { t } = useI18n();
  const product = use(getProduct(productId));

  if (product === "unauthorized") {
    return (
      <section className="content products-page">
        <p className="products-message">{t("login.headline")}</p>
        <Link className="back-link" href="/manager/login">{t("login.submit")}</Link>
      </section>
    );
  }
  if (product === "missing") {
    return (
      <section className="content products-page">
        <p className="products-message">{t("product.notFound")}</p>
        <Link className="back-link" href="/manager/products">{t("product.backToList")}</Link>
      </section>
    );
  }

  return <ListingsWorkspace product={product} />;
}

function ListingsWorkspace({ product }: { product: ProductSummary }) {
  const { t } = useI18n();
  const [categoryName, setCategoryName] = useState(product.otto_category_name);
  const [groupName, setGroupName] = useState(product.otto_category_group_name);

  return (
    <section className="content listing-workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("listing.pageEyebrow")}</p>
          <h1>{product.title}</h1>
          <p className="products-subtitle">{t("listing.pageHint")}</p>
        </div>
        <div className="topbar-actions">
          <Link className="back-link" href={`/manager/products/${product.id}`}>{t("listing.backToProduct")}</Link>
        </div>
      </header>
      <div className="listing-workspace-grid">
        <ListingPrep
          productId={product.id}
          publishHref={`/manager/marketplaces?product=${product.id}`}
        />
        <OttoCategoryPicker
          productId={product.id}
          categoryName={categoryName}
          groupName={groupName}
          onSaved={(next) => {
            setCategoryName(next.otto_category_name);
            setGroupName(next.otto_category_group_name);
            productCache.delete(product.id);
          }}
        />
      </div>
    </section>
  );
}
