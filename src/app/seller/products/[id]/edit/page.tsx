"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProductEditor from "@/components/seller/ProductEditor";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import { sellerRequest, type SellerProduct } from "@/lib/seller";

export default function EditSellerProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    sellerRequest<SellerProduct>(`/api/v1/products/${id}/`, { signal: controller.signal })
      .then(setProduct)
      .catch(value => { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : "Could not load product."); });
    return () => controller.abort();
  }, [id]);

  return <SellerPage title="Edit product" description="Seller changes to approved products are sent for moderation.">
    {error ? <SellerNotice>{error}</SellerNotice> : product ? <ProductEditor product={product} /> : <SellerLoadingState label="Loading product…" rows={4} />}
  </SellerPage>;
}
