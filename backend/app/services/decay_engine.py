import math
import datetime
from typing import Dict, Any, List, Optional

# Default baseline parameters per crop (ICAR-CIPHET post-harvest guidelines)
DEFAULT_CROP_PROFILES = {
    "Tomato": {
        "name_hi": "टमाटर",
        "base_shelf_life_hours": 144.0,  # 6 days at 20°C
        "optimal_temp_c": 12.0,
        "base_fresh_price_per_kg": 28.0,
        "processing_rate_per_kg": 22.0, # Puree / Paste yield value
        "processing_cost_per_kg": 3.5,
        "cold_storage_rate_per_day_kg": 0.40,
        "transport_base_per_kg_km": 0.035,
        "q10_factor": 2.0,
        "spoilage_threshold_hrs": 120.0
    },
    "Onion": {
        "name_hi": "प्याज",
        "base_shelf_life_hours": 720.0,  # 30 days at 20°C
        "optimal_temp_c": 22.0,
        "base_fresh_price_per_kg": 35.0,
        "processing_rate_per_kg": 32.0, # Dehydration
        "processing_cost_per_kg": 5.0,
        "cold_storage_rate_per_day_kg": 0.20,
        "transport_base_per_kg_km": 0.030,
        "q10_factor": 1.6,
        "spoilage_threshold_hrs": 600.0
    },
    "Potato": {
        "name_hi": "आलू",
        "base_shelf_life_hours": 960.0,  # 40 days at 20°C
        "optimal_temp_c": 10.0,
        "base_fresh_price_per_kg": 20.0,
        "processing_rate_per_kg": 24.0, # Chips / Flakes
        "processing_cost_per_kg": 4.5,
        "cold_storage_rate_per_day_kg": 0.25,
        "transport_base_per_kg_km": 0.030,
        "q10_factor": 1.5,
        "spoilage_threshold_hrs": 800.0
    },
    "Mango": {
        "name_hi": "आम",
        "base_shelf_life_hours": 168.0,  # 7 days at 20°C
        "optimal_temp_c": 13.0,
        "base_fresh_price_per_kg": 65.0,
        "processing_rate_per_kg": 50.0, # Pulp / Canning
        "processing_cost_per_kg": 8.0,
        "cold_storage_rate_per_day_kg": 0.60,
        "transport_base_per_kg_km": 0.040,
        "q10_factor": 2.2,
        "spoilage_threshold_hrs": 140.0
    },
    "Apple": {
        "name_hi": "सेब",
        "base_shelf_life_hours": 504.0,  # 21 days at 20°C
        "optimal_temp_c": 4.0,
        "base_fresh_price_per_kg": 90.0,
        "processing_rate_per_kg": 65.0, # Juice / Cider
        "processing_cost_per_kg": 10.0,
        "cold_storage_rate_per_day_kg": 0.50,
        "transport_base_per_kg_km": 0.045,
        "q10_factor": 1.8,
        "spoilage_threshold_hrs": 400.0
    },
    "Banana": {
        "name_hi": "केला",
        "base_shelf_life_hours": 120.0,  # 5 days at 20°C
        "optimal_temp_c": 14.0,
        "base_fresh_price_per_kg": 24.0,
        "processing_rate_per_kg": 20.0, # Chips / Powder
        "processing_cost_per_kg": 4.0,
        "cold_storage_rate_per_day_kg": 0.40,
        "transport_base_per_kg_km": 0.035,
        "q10_factor": 2.1,
        "spoilage_threshold_hrs": 96.0
    },
    "Cauliflower": {
        "name_hi": "फूलगोभी",
        "base_shelf_life_hours": 96.0,   # 4 days at 20°C
        "optimal_temp_c": 5.0,
        "base_fresh_price_per_kg": 22.0,
        "processing_rate_per_kg": 16.0, # IQF Frozen
        "processing_cost_per_kg": 3.5,
        "cold_storage_rate_per_day_kg": 0.45,
        "transport_base_per_kg_km": 0.038,
        "q10_factor": 2.3,
        "spoilage_threshold_hrs": 72.0
    },
    "Guava": {
        "name_hi": "अमरूद",
        "base_shelf_life_hours": 120.0,  # 5 days at 20°C
        "optimal_temp_c": 10.0,
        "base_fresh_price_per_kg": 30.0,
        "processing_rate_per_kg": 25.0, # Jam / Jelly
        "processing_cost_per_kg": 4.5,
        "cold_storage_rate_per_day_kg": 0.40,
        "transport_base_per_kg_km": 0.035,
        "q10_factor": 2.0,
        "spoilage_threshold_hrs": 96.0
    }
}

class DecayEngine:
    """
    Q10-style temperature decay model (SRS Section 5.3.1).
    Decay rate doubles for every 10°C rise above a 20°C baseline.
    """

    @staticmethod
    def compute_temperature_factor(temp_c: float, q10: float = 2.0) -> float:
        """
        TF = q10 ** ((temp_c - 20.0) / 10.0)
        """
        exponent = (temp_c - 20.0) / 10.0
        return max(0.2, math.pow(q10, exponent))

    @staticmethod
    def compute_effective_shelf_life(base_shelf_life_hrs: float, temp_c: float, q10: float = 2.0) -> float:
        tf = DecayEngine.compute_temperature_factor(temp_c, q10)
        return max(1.0, base_shelf_life_hrs / tf)

    @staticmethod
    def compute_quality(hours_elapsed: float, effective_shelf_life: float, initial_quality: float = 100.0) -> float:
        """
        quality(t) = initial_quality * (1 - hours_elapsed / effective_shelf_life)
        bounded between 0.0 and 100.0
        """
        fraction_remaining = 1.0 - (hours_elapsed / effective_shelf_life)
        quality = initial_quality * fraction_remaining
        return max(0.0, min(100.0, round(quality, 2)))

    @staticmethod
    def compute_spoilage_risk(quality: float) -> float:
        return max(0.0, min(100.0, round(100.0 - quality, 2)))

    @staticmethod
    def get_risk_category(spoilage_risk: float) -> Dict[str, Any]:
        """
        Returns color-coded category and badge metadata.
        """
        if spoilage_risk >= 70.0:
            return {
                "level": "high",
                "label": "High Risk (Critical)",
                "label_hi": "उच्च जोखिम (गंभीर)",
                "color": "red",
                "bg_class": "bg-red-100 text-red-800 border-red-300",
                "alert_triggered": True
            }
        elif spoilage_risk >= 30.0:
            return {
                "level": "medium",
                "label": "Moderate Risk",
                "label_hi": "मध्यम जोखिम",
                "color": "amber",
                "bg_class": "bg-amber-100 text-amber-800 border-amber-300",
                "alert_triggered": False
            }
        else:
            return {
                "level": "low",
                "label": "Low Risk (Fresh)",
                "label_hi": "कम जोखिम (ताजा)",
                "color": "emerald",
                "bg_class": "bg-emerald-100 text-emerald-800 border-emerald-300",
                "alert_triggered": False
            }

    @staticmethod
    def compute_batch_digital_twin(
        crop: str,
        harvest_time: datetime.datetime,
        ambient_temp_c: float,
        initial_quality: float = 98.0,
        current_time: Optional[datetime.datetime] = None
    ) -> Dict[str, Any]:
        if current_time is None:
            current_time = datetime.datetime.utcnow()

        crop_profile = DEFAULT_CROP_PROFILES.get(crop, DEFAULT_CROP_PROFILES["Tomato"])
        base_shelf_life = crop_profile["base_shelf_life_hours"]
        q10 = crop_profile.get("q10_factor", 2.0)

        hours_elapsed = max(0.0, (current_time - harvest_time).total_seconds() / 3600.0)
        temp_factor = DecayEngine.compute_temperature_factor(ambient_temp_c, q10)
        effective_shelf_life = DecayEngine.compute_effective_shelf_life(base_shelf_life, ambient_temp_c, q10)
        current_quality = DecayEngine.compute_quality(hours_elapsed, effective_shelf_life, initial_quality)
        spoilage_risk = DecayEngine.compute_spoilage_risk(current_quality)
        
        remaining_shelf_life_hrs = max(0.0, round(effective_shelf_life - hours_elapsed, 1))
        remaining_shelf_life_days = round(remaining_shelf_life_hrs / 24.0, 1)

        risk_meta = DecayEngine.get_risk_category(spoilage_risk)

        # Generate trajectory forecast for the next 7 days / decay span
        trajectory = []
        step_hours = max(4.0, effective_shelf_life / 12.0)
        total_steps = int(effective_shelf_life / step_hours) + 3
        for step in range(total_steps):
            t_hrs = step * step_hours
            q = DecayEngine.compute_quality(t_hrs, effective_shelf_life, initial_quality)
            risk = DecayEngine.compute_spoilage_risk(q)
            forecast_time = harvest_time + datetime.timedelta(hours=t_hrs)
            trajectory.append({
                "hours_from_harvest": round(t_hrs, 1),
                "timestamp": forecast_time.isoformat(),
                "projected_quality": q,
                "projected_risk": risk,
                "is_current": abs(t_hrs - hours_elapsed) <= (step_hours / 2)
            })

        return {
            "crop": crop,
            "crop_name_hi": crop_profile["name_hi"],
            "hours_elapsed": round(hours_elapsed, 1),
            "ambient_temp_c": ambient_temp_c,
            "temperature_factor": round(temp_factor, 3),
            "base_shelf_life_hrs": base_shelf_life,
            "effective_shelf_life_hrs": round(effective_shelf_life, 1),
            "current_quality": current_quality,
            "spoilage_risk": spoilage_risk,
            "remaining_shelf_life_hrs": remaining_shelf_life_hrs,
            "remaining_shelf_life_days": remaining_shelf_life_days,
            "risk_level": risk_meta["level"],
            "risk_label": risk_meta["label"],
            "risk_label_hi": risk_meta["label_hi"],
            "risk_color": risk_meta["color"],
            "risk_bg_class": risk_meta["bg_class"],
            "alert_banner": risk_meta["alert_triggered"],
            "trajectory": trajectory
        }
