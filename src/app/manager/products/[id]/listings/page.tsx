"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, use, useState } from "react";

import { ListingPrep } from "@/components/ListingPrep";
import { ProductPublishPanel } from "@/components/ProductPublishPanel";
import { EmptyState, PageContainer, PageHeader, SectionCard } from "@/components/manager/ui";
import { OttoCategoryPicker } from "@/components/OttoCategoryPicker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { authorizedFetch } from "@/lib/api";

type ProductSummary = {
  id: number;
  title: string;
  status?: string;
  otto_category_name: string | null;
  otto_category_group_name: string | null;
  otto_category_id: number | null;
  otto_category_group_id: number | null;
  otto_attributes: Record<string, unknown>;
};

type ProductLoad = ProductSummary | "unauthorized" | "missing" | "failed";

const productCache = new Map<number, Promise<ProductLoad>>();

function getProduct(productId: number) {
  const cached = productCache.get(productId);
  if (cached) return cached;
  const request = authorizedFetch(`/api/v1/products/${productId}/`)
    .then(async (response) => {
      if (response.status === 401) return "unauthorized" as const;
      if (response.status === 404) return "missing" as const;
      if (!response.ok) return "failed" as const;
      return (await response.json()) as ProductSummary;
    })
    .catch(() => "failed" as const);
  productCache.set(productId, request);
  return request;
}

export default function ProductListingsPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    return (
      <PageContainer>
        <EmptyState title={t("product.notFound")} />
      </PageContainer>
    );
  }

  return (
    <Suspense
      fallback={
        <PageContainer>
          <PageHeader
            breadcrumbs={[
              { label: t("nav.products"), href: "/manager/products" },
              { label: `#${productId}`, href: `/manager/products/${productId}` },
              { label: t("listing.eyebrow") },
            ]}
            title={t("common.loading")}
          />
          <SectionCard padded>
            <div className="grid gap-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </SectionCard>
        </PageContainer>
      }
    >
      <ListingsLoaded productId={productId} />
    </Suspense>
  );
}

function ListingsLoaded({ productId }: { productId: number }) {
  const { t } = useI18n();
  const product = use(getProduct(productId));

  if (product === "unauthorized") {
    return (
      <PageContainer>
        <EmptyState title={t("login.headline")} description={t("login.submit")} />
        <div className="mt-4 flex justify-center">
          <Button asChild variant="accent">
            <Link href="/manager/login">{t("login.submit")}</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }
  if (product === "missing" || product === "failed") {
    return (
      <PageContainer>
        <EmptyState
          title={product === "missing" ? t("product.notFound") : t("listing.loadFailed")}
          description={product === "failed" ? t("common.apiUnreachable") : undefined}
        />
        <div className="mt-4 flex justify-center">
          <Button asChild variant="secondary">
            <Link href="/manager/products">{t("product.backToList")}</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return <ListingsWorkspace product={product} />;
}

function ListingsWorkspace({ product }: { product: ProductSummary }) {
  const { t } = useI18n();
  const [categoryName, setCategoryName] = useState(product.otto_category_name);
  const [groupName, setGroupName] = useState(product.otto_category_group_name);

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: t("nav.products"), href: "/manager/products" },
          { label: `#${product.id}`, href: `/manager/products/${product.id}` },
          { label: t("listing.eyebrow") },
        ]}
        title={product.title}
        description={t("listing.pageHint")}
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href={`/manager/products/${product.id}`}>{t("listing.backToProduct")}</Link>
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <ListingPrep productId={product.id} />
        <OttoCategoryPicker
          productId={product.id}
          categoryName={categoryName}
          groupName={groupName}
          categoryId={product.otto_category_id}
          groupId={product.otto_category_group_id}
          attributes={product.otto_attributes || {}}
          onSaved={(next) => {
            setCategoryName(next.otto_category_name);
            setGroupName(next.otto_category_group_name);
            productCache.delete(product.id);
          }}
        />
      </div>
      <div className="mt-4">
        <ProductPublishPanel productId={product.id} productStatus={product.status} />
      </div>
    </PageContainer>
  );
}
