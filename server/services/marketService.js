export const INITIAL_MANDI_FEED = [
  {
    crop: 'Tomato',
    mandi: 'Kolar APMC Mandi',
    state: 'Karnataka',
    distance_km: 18.0,
    modal_price_per_kg: 26.5,
    min_price_per_kg: 22.0,
    max_price_per_kg: 30.0,
    trend: 'rising',
    price_change_pct: 5.8,
    arrivals_tonnes: 340.0,
    demand_index: 'High'
  },
  {
    crop: 'Tomato',
    mandi: 'Azadpur Mandi, Delhi',
    state: 'Delhi NCR',
    distance_km: 1850.0,
    modal_price_per_kg: 42.0,
    min_price_per_kg: 36.0,
    max_price_per_kg: 48.0,
    trend: 'rising',
    price_change_pct: 8.4,
    arrivals_tonnes: 1120.0,
    demand_index: 'Very High'
  },
  {
    crop: 'Tomato',
    mandi: 'Vashi APMC, Mumbai',
    state: 'Maharashtra',
    distance_km: 980.0,
    modal_price_per_kg: 38.5,
    min_price_per_kg: 32.0,
    max_price_per_kg: 44.0,
    trend: 'flat',
    price_change_pct: 0.5,
    arrivals_tonnes: 680.0,
    demand_index: 'High'
  },
  {
    crop: 'Onion',
    mandi: 'Lasalgaon Mandi, Nashik',
    state: 'Maharashtra',
    distance_km: 850.0,
    modal_price_per_kg: 36.0,
    min_price_per_kg: 30.0,
    max_price_per_kg: 42.0,
    trend: 'rising',
    price_change_pct: 6.2,
    arrivals_tonnes: 2400.0,
    demand_index: 'High'
  },
  {
    crop: 'Onion',
    mandi: 'Yeshwantpur Mandi, Bengaluru',
    state: 'Karnataka',
    distance_km: 65.0,
    modal_price_per_kg: 34.0,
    min_price_per_kg: 28.0,
    max_price_per_kg: 38.0,
    trend: 'flat',
    price_change_pct: -0.8,
    arrivals_tonnes: 480.0,
    demand_index: 'Moderate'
  },
  {
    crop: 'Potato',
    mandi: 'Agra APMC',
    state: 'Uttar Pradesh',
    distance_km: 1720.0,
    modal_price_per_kg: 18.5,
    min_price_per_kg: 15.0,
    max_price_per_kg: 22.0,
    trend: 'falling',
    price_change_pct: -4.2,
    arrivals_tonnes: 3200.0,
    demand_index: 'Moderate'
  },
  {
    crop: 'Potato',
    mandi: 'Kolar Local Sub-Market',
    state: 'Karnataka',
    distance_km: 12.0,
    modal_price_per_kg: 22.0,
    min_price_per_kg: 19.0,
    max_price_per_kg: 25.0,
    trend: 'rising',
    price_change_pct: 3.1,
    arrivals_tonnes: 140.0,
    demand_index: 'High'
  },
  {
    crop: 'Mango',
    mandi: 'Srinivaspur Mango Mandi',
    state: 'Karnataka',
    distance_km: 28.0,
    modal_price_per_kg: 68.0,
    min_price_per_kg: 55.0,
    max_price_per_kg: 85.0,
    trend: 'rising',
    price_change_pct: 11.5,
    arrivals_tonnes: 890.0,
    demand_index: 'Very High'
  },
  {
    crop: 'Apple',
    mandi: 'Azadpur Apple Terminal, Delhi',
    state: 'Delhi NCR',
    distance_km: 1850.0,
    modal_price_per_kg: 95.0,
    min_price_per_kg: 80.0,
    max_price_per_kg: 120.0,
    trend: 'rising',
    price_change_pct: 4.5,
    arrivals_tonnes: 1600.0,
    demand_index: 'High'
  }
].map((entry) => ({
  ...entry,
  source_type: 'demo_seed'
}));

export class MarketService {
  static getMarketPrices(crop = null, feed = INITIAL_MANDI_FEED) {
    if (crop) {
      return feed.filter((p) => p.crop.toLowerCase() === crop.toLowerCase());
    }
    return feed;
  }

  static getBestAlternateMarket(crop, currentMandi = '', feed = INITIAL_MANDI_FEED) {
    const candidates = feed.filter(
      (p) => p.crop.toLowerCase() === crop.toLowerCase() && p.mandi !== currentMandi
    );
    if (candidates.length === 0) {
      return {
        mandi: 'Regional Terminal Hub',
        state: 'National Hub',
        distance_km: 120.0,
        modal_price_per_kg: 35.0,
        trend: 'rising'
      };
    }
    return candidates.reduce((best, curr) =>
      curr.modal_price_per_kg > best.modal_price_per_kg ? curr : best
    );
  }
}
