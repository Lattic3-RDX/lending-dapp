import { AssetName, getAssetPrice } from "@/types/asset";

interface PriceCache {
  price: number;
  timestamp: number;
}

const CACHE_DURATION = 10 * 1000; // 10 seconds cache duration
const priceCache = new Map<string, PriceCache>();

export async function getCachedAssetPrice(assetName: string): Promise<number> {
  const cached = priceCache.get(assetName);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.price;
  }

  // If cache miss or expired, fetch new price
  const price = await getAssetPrice(assetName as AssetName);
  priceCache.set(assetName, {
    price,
    timestamp: now
  });

  return price;
} 