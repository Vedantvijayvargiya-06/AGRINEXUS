import { DecayEngine, DEFAULT_CROP_PROFILES } from './decayEngine.js';

function round(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function fmtInr(num) {
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtInt(num) {
  return Math.round(num).toLocaleString('en-US');
}

export class DecisionEngine {
  static evaluateBatchDecision({
    crop,
    quantityKg,
    currentQuality,
    ambientTempC,
    hoursElapsed,
    localMandiPricePerKg,
    alternateMandiPricePerKg,
    distanceLocalKm = 35.0,
    distanceAlternateKm = 140.0,
    storageDays = 7,
    projectedPriceIncreasePct = 15.0,
    isPooled = false,
    customParams = null,
    cropProfileOverride = null
  }) {
    const params = customParams || {};
    const cropProfile =
      cropProfileOverride || DEFAULT_CROP_PROFILES[crop] || DEFAULT_CROP_PROFILES.Tomato;

    const safeQty = Math.max(1, Number(quantityKg) || 1);
    const safeQuality = Math.max(0, Math.min(100, Number(currentQuality) || 0));
    const safeLocalPrice = Math.max(0, Number(localMandiPricePerKg) || 0);
    const safeAltPrice = Math.max(0, Number(alternateMandiPricePerKg) || 0);
    const safeStorageDays = Math.max(1, Math.min(90, parseInt(storageDays, 10) || 7));
    const safePriceSurgePct = Math.max(-80, Math.min(200, Number(projectedPriceIncreasePct) || 0));

    const transportRatePerKgKm =
      params.transport_rate ?? cropProfile.transport_base_per_kg_km ?? 0.035;
    const pooledDiscountFactor = isPooled ? (params.pooled_discount ?? 0.4) : 1.0;
    const coldStorageRateDay =
      params.storage_rate ?? cropProfile.cold_storage_rate_per_day_kg ?? 0.4;
    const processingValueRate =
      params.processing_rate ?? cropProfile.processing_rate_per_kg ?? 22.0;
    const processingCostRate =
      params.processing_cost ?? cropProfile.processing_cost_per_kg ?? 3.5;

    const qualityFactor = Math.max(0.1, safeQuality / 100.0);

    // 1. SELL NOW
    const soloTransportLocal = safeQty * distanceLocalKm * transportRatePerKgKm;
    const transportCostSell = soloTransportLocal * pooledDiscountFactor;
    const grossSell = safeQty * safeLocalPrice * qualityFactor;
    const netSell = round(grossSell - transportCostSell, 2);

    // 2. STORE (decay from currentQuality over additional cold storage duration only)
    const storageTemp = cropProfile.optimal_temp_c ?? 10.0;
    const storageHours = safeStorageDays * 24.0;
    const effectiveLifeCold = DecayEngine.computeEffectiveShelfLife(
      cropProfile.base_shelf_life_hours,
      storageTemp,
      cropProfile.q10_factor ?? 2.0
    );
    const projectedQualityAfterStorage = DecayEngine.computeQuality(
      storageHours,
      effectiveLifeCold,
      safeQuality
    );
    const projectedQualityFactor = Math.max(0.1, projectedQualityAfterStorage / 100.0);
    const futureMandiPrice = safeLocalPrice * (1.0 + safePriceSurgePct / 100.0);
    const storageCost = safeQty * coldStorageRateDay * safeStorageDays;
    const grossStore = safeQty * futureMandiPrice * projectedQualityFactor;
    const netStore = round(grossStore - storageCost - transportCostSell, 2);

    // 3. PROCESS
    const grossProcess = safeQty * processingValueRate;
    const processingCostTotal = safeQty * processingCostRate;
    const netProcess = round(grossProcess - processingCostTotal, 2);

    // 4. REDIRECT (cluster pooling cuts terminal freight cost)
    const soloTransportAlt = safeQty * distanceAlternateKm * transportRatePerKgKm;
    const transportCostRedirect = soloTransportAlt * (isPooled ? 0.45 : 0.85);
    const redirectHandlingFee = safeQty * 0.5;
    const grossRedirect = safeQty * safeAltPrice * qualityFactor;
    const netRedirect = round(grossRedirect - transportCostRedirect - redirectHandlingFee, 2);

    const options = [
      {
        action: 'sell_now',
        action_title: 'Sell Immediately (Local Mandi)',
        action_title_hi: 'स्थानीय मंडी में तुरंत बेचें',
        net_value: netSell,
        gross_revenue: round(grossSell, 2),
        total_deductions: round(transportCostSell, 2),
        risk_profile: 'Zero Price Risk, Immediate Cash Liquidity',
        risk_profile_hi: 'शून्य मूल्य जोखिम, तत्काल नकद भुगतान',
        formula_str: `(${safeQty} kg × ₹${safeLocalPrice}/kg × ${qualityFactor.toFixed(2)}) - ₹${transportCostSell.toFixed(2)} transport`
      },
      {
        action: 'store',
        action_title: `Cold Store (${safeStorageDays} Days) for Price Upsurge`,
        action_title_hi: `मूल्य वृद्धि के लिए कोल्ड स्टोरेज (${safeStorageDays} दिन) में रखें`,
        net_value: netStore,
        gross_revenue: round(grossStore, 2),
        total_deductions: round(storageCost + transportCostSell, 2),
        risk_profile: `Medium Risk; Projected +${safePriceSurgePct}% Mandi Price Lift`,
        risk_profile_hi: `मध्यम जोखिम; अनुमानित +${safePriceSurgePct}% मंडी भाव उछाल`,
        formula_str: `(${safeQty} kg × ₹${futureMandiPrice.toFixed(2)}/kg × ${projectedQualityFactor.toFixed(2)}) - ₹${storageCost.toFixed(2)} storage - ₹${transportCostSell.toFixed(2)} transport`
      },
      {
        action: 'process',
        action_title: 'FPO / Local Secondary Processing',
        action_title_hi: 'एफपीओ / स्थानीय प्रसंस्करण इकाई को भेजें',
        net_value: netProcess,
        gross_revenue: round(grossProcess, 2),
        total_deductions: round(processingCostTotal, 2),
        risk_profile: 'Guaranteed Floor Price, Immune to Cosmetic Decay',
        risk_profile_hi: 'न्यूनतम गारंटीकृत मूल्य, गुणवत्ता गिरावट से सुरक्षित',
        formula_str: `(${safeQty} kg × ₹${processingValueRate}/kg) - ₹${processingCostTotal.toFixed(2)} processing fee`
      },
      {
        action: 'redirect',
        action_title: 'Redirect to High-Demand Terminal Market',
        action_title_hi: 'उच्च मांग वाली बड़ी टर्मिनल मंडी में भेजें',
        net_value: netRedirect,
        gross_revenue: round(grossRedirect, 2),
        total_deductions: round(transportCostRedirect + redirectHandlingFee, 2),
        risk_profile: 'Higher Freight Distance; Premium Realization with Cluster Pooling',
        risk_profile_hi: 'अधिक दूरी; क्लस्टर पूलिंग के साथ प्रीमियम आय',
        formula_str: `(${safeQty} kg × ₹${safeAltPrice}/kg × ${qualityFactor.toFixed(2)}) - ₹${transportCostRedirect.toFixed(2)} ${isPooled ? 'pooled' : 'solo'} freight - ₹${redirectHandlingFee.toFixed(2)} fee`
      }
    ];

    const ranked = [...options].sort((a, b) => b.net_value - a.net_value);
    const winner = ranked[0];
    const runnerUp = ranked[1];
    const profitDelta = round(winner.net_value - runnerUp.net_value, 2);

    const explanationEn = DecisionEngine._generateExplanationEn(
      winner.action,
      winner.net_value,
      profitDelta,
      runnerUp.action,
      crop,
      safeQty,
      safeQuality,
      safeLocalPrice,
      safeAltPrice,
      safeStorageDays,
      safePriceSurgePct
    );

    const explanationHi = DecisionEngine._generateExplanationHi(
      winner.action,
      winner.net_value,
      profitDelta,
      runnerUp.action,
      crop,
      cropProfile.name_hi,
      safeQty,
      safeQuality,
      safeLocalPrice,
      safeAltPrice,
      safeStorageDays,
      safePriceSurgePct
    );

    return {
      recommended_action: winner.action,
      recommended_title: winner.action_title,
      recommended_title_hi: winner.action_title_hi,
      best_expected_value: winner.net_value,
      profit_delta_vs_runner_up: profitDelta,
      runner_up_action: runnerUp.action,
      net_values: {
        sell_now: netSell,
        store: netStore,
        process: netProcess,
        redirect: netRedirect
      },
      options_comparison: options,
      formula_breakdown: {
        inputs: {
          crop,
          quantity_kg: safeQty,
          current_quality_pct: safeQuality,
          local_mandi_price: safeLocalPrice,
          alternate_mandi_price: safeAltPrice,
          storage_days: safeStorageDays,
          projected_price_surge_pct: safePriceSurgePct,
          is_cluster_pooled: isPooled
        },
        calculations: {
          sell_now: {
            gross: round(grossSell, 2),
            transport: round(transportCostSell, 2),
            net: netSell
          },
          store: {
            gross: round(grossStore, 2),
            storage_cost: round(storageCost, 2),
            transport: round(transportCostSell, 2),
            projected_quality_pct: round(projectedQualityAfterStorage, 1),
            net: netStore
          },
          process: {
            gross: round(grossProcess, 2),
            processing_fee: round(processingCostTotal, 2),
            net: netProcess
          },
          redirect: {
            gross: round(grossRedirect, 2),
            freight_cost: round(transportCostRedirect, 2),
            handling_fee: round(redirectHandlingFee, 2),
            net: netRedirect
          }
        }
      },
      explanation_en: explanationEn,
      explanation_hi: explanationHi,
      confidence_score: 0.95
    };
  }

  static _generateExplanationEn(
    action,
    bestVal,
    delta,
    runnerUp,
    crop,
    qty,
    quality,
    localPrice,
    altPrice,
    storageDays,
    priceSurge
  ) {
    const ru = runnerUp.replace(/_/g, ' ');
    if (action === 'redirect') {
      return `Recommendation: Redirect this ${fmtInt(qty)} kg batch to the high-demand terminal market. Expected net income is ₹${fmtInr(bestVal)} (+₹${fmtInr(delta)} higher than ${ru}). The target market offers ₹${altPrice.toFixed(2)}/kg vs local rate of ₹${localPrice.toFixed(2)}/kg, comfortably outweighing pooled freight expenses while batch quality remains high (${Math.round(quality)}%).`;
    } else if (action === 'store') {
      return `Recommendation: Place this ${fmtInt(qty)} kg batch into Cold Storage for ${storageDays} days. Expected net realization is ₹${fmtInr(bestVal)} (+₹${fmtInr(delta)} over ${ru}). Market intelligence predicts a +${Math.round(priceSurge)}% price surge, and controlled cold atmosphere will preserve ${fmtInt(qty)} kg produce with minimal decay.`;
    } else if (action === 'process') {
      return `Recommendation: Divert this ${fmtInt(qty)} kg batch to FPO / Local Food Processing. Expected net return is ₹${fmtInr(bestVal)} (+₹${fmtInr(delta)} over ${ru}). Given current quality (${Math.round(quality)}%) or local market softening, value-added processing eliminates spoilage risk and locks in guaranteed returns.`;
    }
    return `Recommendation: Sell immediately in the local Mandi. Expected net return is ₹${fmtInr(bestVal)} (+₹${fmtInr(delta)} over ${ru}). Current fresh mandi price (₹${localPrice.toFixed(2)}/kg) provides optimal immediate profit without cold storage holding charges or transit risk.`;
  }

  static _generateExplanationHi(
    action,
    bestVal,
    delta,
    runnerUp,
    crop,
    cropHi,
    qty,
    quality,
    localPrice,
    altPrice,
    storageDays,
    priceSurge
  ) {
    if (action === 'redirect') {
      return `सिफारिश: इस ${fmtInt(qty)} किलो ${cropHi} को उच्च मांग वाली बड़ी टर्मिनल मंडी में भेजें। अनुमानित शुद्ध आय ₹${fmtInr(bestVal)} होगी (दूसरे विकल्प की तुलना में ₹${fmtInr(delta)} अधिक लाभ)। टर्मिनल मंडी में ₹${altPrice.toFixed(2)}/किलो का प्रीमियम भाव मिल रहा है जो साझा ढुलाई खर्च के बाद भी सर्वाधिक लाभ देता है।`;
    } else if (action === 'store') {
      return `सिफारिश: इस ${fmtInt(qty)} किलो ${cropHi} को ${storageDays} दिनों के लिए कोल्ड स्टोरेज में रखें। अनुमानित शुद्ध आय ₹${fmtInr(bestVal)} होगी (+₹${fmtInr(delta)} अतिरिक्त लाभ)। मंडी में +${Math.round(priceSurge)}% मूल्य उछाल का पूर्वानुमान है और कोल्ड स्टोरेज में फसल सुरक्षित रहेगी।`;
    } else if (action === 'process') {
      return `सिफारिश: इस ${fmtInt(qty)} किलो ${cropHi} को एफपीओ फूड प्रोसेसिंग यूनिट में भेजें। अनुमानित शुद्ध आय ₹${fmtInr(bestVal)} होगी (+₹${fmtInr(delta)} अतिरिक्त लाभ)। गुणवत्ता (${Math.round(quality)}%) के अनुसार प्रसंस्करण करने से खराब होने का शून्य जोखिम रहता है और तय आय सुनिश्चित होती है।`;
    }
    return `सिफारिश: स्थानीय मंडी में तुरंत बेचें। अनुमानित शुद्ध आय ₹${fmtInr(bestVal)} होगी (+₹${fmtInr(delta)} अतिरिक्त लाभ)। वर्तमान भाव (₹${localPrice.toFixed(2)}/किलो) पर तुरंत बेचने से बिना किसी स्टोरेज लागत के तुरंत नकद लाभ प्राप्त होगा।`;
  }
}
