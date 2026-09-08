import { MarketplacesBoard } from "./MarketplacesBoard";

export default async function MarketplacesPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawProduct = params.product;
  const rawQuery = params.q;
  const fromProduct = Array.isArray(rawProduct) ? rawProduct[0] ?? "" : rawProduct ?? "";
  const fromQuery = Array.isArray(rawQuery) ? rawQuery[0] ?? "" : rawQuery ?? "";
  const initialQuery = fromQuery || fromProduct;
  return <MarketplacesBoard initialQuery={initialQuery} />;
}
