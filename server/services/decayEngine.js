export const DEFAULT_CROP_PROFILES = {
  Tomato: {
    name_hi: 'टमाटर',
    base_shelf_life_hours: 144.0,
    optimal_temp_c: 12.0,
    base_fresh_price_per_kg: 28.0,
    processing_rate_per_kg: 22.0,
    processing_cost_per_kg: 3.5,
    cold_storage_rate_per_day_kg: 0.4,
    transport_base_per_kg_km: 0.035,
    q10_factor: 2.0,
    spoilage_threshold_hrs: 120.0
  },
  Onion: {
    name_hi: 'प्याज',
    base_shelf_life_hours: 720.0,
    optimal_temp_c: 22.0,
    base_fresh_price_per_kg: 35.0,
    processing_rate_per_kg: 32.0,
    processing_cost_per_kg: 5.0,
    cold_storage_rate_per_day_kg: 0.2,
    transport_base_per_kg_km: 0.03,
    q10_factor: 1.6,
    spoilage_threshold_hrs: 600.0
  },
  Potato: {
    name_hi: 'आलू',
    base_shelf_life_hours: 960.0,
    optimal_temp_c: 10.0,
    base_fresh_price_per_kg: 20.0,
    processing_rate_per_kg: 24.0,
    processing_cost_per_kg: 4.5,
    cold_storage_rate_per_day_kg: 0.25,
    transport_base_per_kg_km: 0.03,
    q10_factor: 1.5,
    spoilage_threshold_hrs: 800.0
  },
  Mango: {
    name_hi: 'आम',
    base_shelf_life_hours: 168.0,
    optimal_temp_c: 13.0,
    base_fresh_price_per_kg: 65.0,
    processing_rate_per_kg: 50.0,
    processing_cost_per_kg: 8.0,
    cold_storage_rate_per_day_kg: 0.6,
    transport_base_per_kg_km: 0.04,
    q10_factor: 2.2,
    spoilage_threshold_hrs: 140.0
  },
  Apple: {
    name_hi: 'सेब',
    base_shelf_life_hours: 504.0,
    optimal_temp_c: 4.0,
    base_fresh_price_per_kg: 90.0,
    processing_rate_per_kg: 65.0,
    processing_cost_per_kg: 10.0,
    cold_storage_rate_per_day_kg: 0.5,
    transport_base_per_kg_km: 0.045,
    q10_factor: 1.8,
    spoilage_threshold_hrs: 400.0
  },
  Banana: {
    name_hi: 'केला',
    base_shelf_life_hours: 120.0,
    optimal_temp_c: 14.0,
    base_fresh_price_per_kg: 24.0,
    processing_rate_per_kg: 20.0,
    processing_cost_per_kg: 4.0,
    cold_storage_rate_per_day_kg: 0.4,
    transport_base_per_kg_km: 0.035,
    q10_factor: 2.1,
    spoilage_threshold_hrs: 96.0
  },
  Cauliflower: {
    name_hi: 'फूलगोभी',
    base_shelf_life_hours: 96.0,
    optimal_temp_c: 5.0,
    base_fresh_price_per_kg: 22.0,
    processing_rate_per_kg: 16.0,
    processing_cost_per_kg: 3.5,
    cold_storage_rate_per_day_kg: 0.45,
    transport_base_per_kg_km: 0.038,
    q10_factor: 2.3,
    spoilage_threshold_hrs: 72.0
  },
  Guava: {
    name_hi: 'अमरूद',
    base_shelf_life_hours: 120.0,
    optimal_temp_c: 10.0,
    base_fresh_price_per_kg: 30.0,
    processing_rate_per_kg: 25.0,
    processing_cost_per_kg: 4.5,
    cold_storage_rate_per_day_kg: 0.4,
    transport_base_per_kg_km: 0.035,
    q10_factor: 2.0,
    spoilage_threshold_hrs: 96.0
  }
};

function round(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export class DecayEngine {
  static computeTemperatureFactor(tempC, q10 = 2.0) {
    const exponent = (tempC - 20.0) / 10.0;
    return Math.max(0.2, Math.pow(q10, exponent));
  }

  static computeEffectiveShelfLife(baseShelfLifeHrs, tempC, q10 = 2.0) {
    const tf = DecayEngine.computeTemperatureFactor(tempC, q10);
    return Math.max(1.0, baseShelfLifeHrs / tf);
  }

  static computeQuality(hoursElapsed, effectiveShelfLife, initialQuality = 100.0) {
    const fractionRemaining = 1.0 - hoursElapsed / effectiveShelfLife;
    const quality = initialQuality * fractionRemaining;
    return Math.max(0.0, Math.min(100.0, round(quality, 2)));
  }

  static computeSpoilageRisk(quality) {
    return Math.max(0.0, Math.min(100.0, round(100.0 - quality, 2)));
  }

  static getRiskCategory(spoilageRisk) {
    if (spoilageRisk >= 70.0) {
      return {
        level: 'high',
        label: 'High Risk (Critical)',
        label_hi: 'उच्च जोखिम (गंभीर)',
        color: 'red',
        bg_class: 'bg-red-100 text-red-800 border-red-300',
        alert_triggered: true
      };
    } else if (spoilageRisk >= 30.0) {
      return {
        level: 'medium',
        label: 'Moderate Risk',
        label_hi: 'मध्यम जोखिम',
        color: 'amber',
        bg_class: 'bg-amber-100 text-amber-800 border-amber-300',
        alert_triggered: false
      };
    }
    return {
      level: 'low',
      label: 'Low Risk (Fresh)',
      label_hi: 'कम जोखिम (ताजा)',
      color: 'emerald',
      bg_class: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      alert_triggered: false
    };
  }

  static computeBatchDigitalTwin({
    crop,
    harvestTime,
    ambientTempC,
    initialQuality = 98.0,
    currentTime = new Date(),
    cropProfileOverride = null
  }) {
    const harvestDate = harvestTime instanceof Date ? harvestTime : new Date(harvestTime);
    const nowDate = currentTime instanceof Date ? currentTime : new Date(currentTime);

    const cropProfile =
      cropProfileOverride || DEFAULT_CROP_PROFILES[crop] || DEFAULT_CROP_PROFILES.Tomato;
    const baseShelfLife = cropProfile.base_shelf_life_hours;
    const q10 = cropProfile.q10_factor ?? 2.0;

    const hoursElapsed = Math.max(0.0, (nowDate.getTime() - harvestDate.getTime()) / 3600000.0);
    const tempFactor = DecayEngine.computeTemperatureFactor(ambientTempC, q10);
    const effectiveShelfLife = DecayEngine.computeEffectiveShelfLife(
      baseShelfLife,
      ambientTempC,
      q10
    );
    const currentQuality = DecayEngine.computeQuality(
      hoursElapsed,
      effectiveShelfLife,
      initialQuality
    );
    const spoilageRisk = DecayEngine.computeSpoilageRisk(currentQuality);

    const remainingShelfLifeHrs = Math.max(0.0, round(effectiveShelfLife - hoursElapsed, 1));
    const remainingShelfLifeDays = round(remainingShelfLifeHrs / 24.0, 1);

    const riskMeta = DecayEngine.getRiskCategory(spoilageRisk);

    const trajectory = [];
    const stepHours = Math.max(4.0, effectiveShelfLife / 12.0);
    const totalSteps = Math.floor(effectiveShelfLife / stepHours) + 3;
    for (let step = 0; step < totalSteps; step++) {
      const tHrs = step * stepHours;
      const q = DecayEngine.computeQuality(tHrs, effectiveShelfLife, initialQuality);
      const risk = DecayEngine.computeSpoilageRisk(q);
      const forecastTime = new Date(harvestDate.getTime() + tHrs * 3600000.0);
      trajectory.push({
        hours_from_harvest: round(tHrs, 1),
        timestamp: forecastTime.toISOString(),
        projected_quality: q,
        projected_risk: risk,
        is_current: Math.abs(tHrs - hoursElapsed) <= stepHours / 2
      });
    }

    return {
      crop,
      crop_name_hi: cropProfile.name_hi,
      hours_elapsed: round(hoursElapsed, 1),
      ambient_temp_c: ambientTempC,
      temperature_factor: round(tempFactor, 3),
      base_shelf_life_hrs: baseShelfLife,
      effective_shelf_life_hrs: round(effectiveShelfLife, 1),
      current_quality: currentQuality,
      spoilage_risk: spoilageRisk,
      remaining_shelf_life_hrs: remainingShelfLifeHrs,
      remaining_shelf_life_days: remainingShelfLifeDays,
      risk_level: riskMeta.level,
      risk_label: riskMeta.label,
      risk_label_hi: riskMeta.label_hi,
      risk_color: riskMeta.color,
      risk_bg_class: riskMeta.bg_class,
      alert_banner: riskMeta.alert_triggered,
      trajectory
    };
  }
}
