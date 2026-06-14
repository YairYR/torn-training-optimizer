import { Prices } from '../engine/cost-model';

const BASE = 'https://api.torn.com';
const COMMENT = 'TrainingOptimizer';

async function call<T>(path: string, key: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}key=${encodeURIComponent(key)}&comment=${COMMENT}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Torn API returned HTTP ${res.status}.`);
  const data = (await res.json()) as T & { error?: { code: number; error: string } };
  if (data.error) throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
  return data;
}

interface RawItems {
  items: Record<string, { name: string; market_value?: number }>;
}

interface RawPointsMarket {
  pointsmarket: Record<string, { cost: number; quantity: number; total: number }>;
}

/**
 * Fetches live prices for the given item names plus the cheapest point price.
 * Both selections are public (any key works). Only requested names are kept.
 */
export async function fetchPrices(key: string, itemNames: string[]): Promise<Prices> {
  const [itemsRes, pointsRes] = await Promise.all([
    call<RawItems>('/torn/?selections=items', key),
    call<RawPointsMarket>('/torn/?selections=pointsmarket', key).catch(() => null),
  ]);

  const wanted = new Set(itemNames);
  const items: Record<string, number> = {};
  for (const entry of Object.values(itemsRes.items)) {
    if (wanted.has(entry.name) && entry.market_value != null) {
      items[entry.name] = entry.market_value;
    }
  }

  let pointPrice: number | null = null;
  if (pointsRes?.pointsmarket) {
    const costs = Object.values(pointsRes.pointsmarket).map((l) => l.cost);
    pointPrice = costs.length ? Math.min(...costs) : null;
  }

  return { items, pointPrice };
}
