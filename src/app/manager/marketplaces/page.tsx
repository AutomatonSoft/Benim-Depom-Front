import { MarketplacesBoard } from "./MarketplacesBoard";

export default async function MarketplacesPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.product;
  const initialProductId = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  return <MarketplacesBoard initialProductId={initialProductId} />;
}
