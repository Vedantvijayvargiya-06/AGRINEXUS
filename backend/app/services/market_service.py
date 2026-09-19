import datetime
from typing import List, Dict, Any, Optional

INITIAL_MANDI_FEED = [
    {
        "crop": "Tomato",
        "mandi": "Kolar APMC Mandi",
        "state": "Karnataka",
        "distance_km": 18.0,
        "modal_price_per_kg": 26.50,
        "min_price_per_kg": 22.00,
        "max_price_per_kg": 30.00,
        "trend": "rising",
        "price_change_pct": 5.8,
        "arrivals_tonnes": 340.0,
        "demand_index": "High"
    },
    {
        "crop": "Tomato",
        "mandi": "Azadpur Mandi, Delhi",
        "state": "Delhi NCR",
        "distance_km": 1850.0,
        "modal_price_per_kg": 42.00,
        "min_price_per_kg": 36.00,
        "max_price_per_kg": 48.00,
        "trend": "rising",
        "price_change_pct": 8.4,
        "arrivals_tonnes": 1120.0,
        "demand_index": "Very High"
    },
    {
        "crop": "Tomato",
        "mandi": "Vashi APMC, Mumbai",
        "state": "Maharashtra",
        "distance_km": 980.0,
        "modal_price_per_kg": 38.50,
        "min_price_per_kg": 32.00,
        "max_price_per_kg": 44.00,
        "trend": "flat",
        "price_change_pct": 0.5,
        "arrivals_tonnes": 680.0,
        "demand_index": "High"
    },
    {
        "crop": "Onion",
        "mandi": "Lasalgaon Mandi, Nashik",
        "state": "Maharashtra",
        "distance_km": 850.0,
        "modal_price_per_kg": 36.00,
        "min_price_per_kg": 30.00,
        "max_price_per_kg": 42.00,
        "trend": "rising",
        "price_change_pct": 6.2,
        "arrivals_tonnes": 2400.0,
        "demand_index": "High"
    },
    {
        "crop": "Onion",
        "mandi": "Yeshwantpur Mandi, Bengaluru",
        "state": "Karnataka",
        "distance_km": 65.0,
        "modal_price_per_kg": 34.00,
        "min_price_per_kg": 28.00,
        "max_price_per_kg": 38.00,
        "trend": "flat",
        "price_change_pct": -0.8,
        "arrivals_tonnes": 480.0,
        "demand_index": "Moderate"
    },
    {
        "crop": "Potato",
        "mandi": "Agra APMC",
        "state": "Uttar Pradesh",
        "distance_km": 1720.0,
        "modal_price_per_kg": 18.50,
        "min_price_per_kg": 15.00,
        "max_price_per_kg": 22.00,
        "trend": "falling",
        "price_change_pct": -4.2,
        "arrivals_tonnes": 3200.0,
        "demand_index": "Moderate"
    },
    {
        "crop": "Potato",
        "mandi": "Kolar Local Sub-Market",
        "state": "Karnataka",
        "distance_km": 12.0,
        "modal_price_per_kg": 22.00,
        "min_price_per_kg": 19.00,
        "max_price_per_kg": 25.00,
        "trend": "rising",
        "price_change_pct": 3.1,
        "arrivals_tonnes": 140.0,
        "demand_index": "High"
    },
    {
        "crop": "Mango",
        "mandi": "Srinivaspur Mango Mandi",
        "state": "Karnataka",
        "distance_km": 28.0,
        "modal_price_per_kg": 68.00,
        "min_price_per_kg": 55.00,
        "max_price_per_kg": 85.00,
        "trend": "rising",
        "price_change_pct": 11.5,
        "arrivals_tonnes": 890.0,
        "demand_index": "Very High"
    },
    {
        "crop": "Apple",
        "mandi": "Azadpur Apple Terminal, Delhi",
        "state": "Delhi NCR",
        "distance_km": 1850.0,
        "modal_price_per_kg": 95.00,
        "min_price_per_kg": 80.00,
        "max_price_per_kg": 120.00,
        "trend": "rising",
        "price_change_pct": 4.5,
        "arrivals_tonnes": 1600.0,
        "demand_index": "High"
    }
]

class MarketService:
    """
    Market Intelligence Engine consuming simulated & cached Agmarknet / eNAM feeds.
    Supports trend analysis and live threshold alerts.
    """

    @staticmethod
    def get_market_prices(crop: Optional[str] = None) -> List[Dict[str, Any]]:
        prices = INITIAL_MANDI_FEED
        if crop:
            prices = [p for p in prices if p["crop"].lower() == crop.lower()]
        return prices

    @staticmethod
    def get_best_alternate_market(crop: str, current_mandi: str = "") -> Dict[str, Any]:
        candidates = [p for p in INITIAL_MANDI_FEED if p["crop"].lower() == crop.lower() and p["mandi"] != current_mandi]
        if not candidates:
            return {
                "mandi": "Regional Terminal Hub",
                "state": "National Hub",
                "distance_km": 120.0,
                "modal_price_per_kg": 35.0,
                "trend": "rising"
            }
        # Pick market with highest modal price
        return max(candidates, key=lambda x: x["modal_price_per_kg"])
