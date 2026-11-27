import { Router } from 'express';
import {
  listMarketPrices,
  getMarketPriceById,
  updateMarketPriceAndNotifyFarmers,
  listUsers,
  listBatches,
  getCropConstant,
  insertRecommendationForBatch
} from '../store.js';
import { DecayEngine } from '../services/decayEngine.js';
import { DecisionEngine } from '../services/decisionEngine.js';
import { MarketService } from '../services/marketService.js';
import { requireAuth, requireRole, HttpError } from '../security.js';

const router = Router();

router.get('/prices', requireAuth, (req, res) => {
  const crop = req.query.crop || null;
  const prices = listMarketPrices(crop);

  res.json(
    prices.map((p) => ({
      id: p.id,
      crop: p.crop,
      mandi: p.mandi,
      state: p.state,
      distance_km: p.distance_km,
      modal_price_per_kg: p.modal_price_per_kg,
      min_price_per_kg: p.min_price_per_kg,
      max_price_per_kg: p.max_price_per_kg,
      trend: p.trend,
      price_change_pct: p.price_change_pct,
      arrivals_tonnes: p.arrivals_tonnes,
      demand_index: p.demand_index,
      is_manual_override: p.is_manual_override,
      source_type: p.source_type,
      fetched_at: new Date(p.fetched_at).toISOString()
    }))
  );
});

router.post('/override-price', requireRole('admin', 'fpo_admin'), (req, res, next) => {
  try {
    const { market_price_id, new_modal_price } = req.body || {};
    const mpId = Number(market_price_id);
    if (!Number.isInteger(mpId) || mpId <= 0) {
      throw new HttpError(400, 'Invalid market_price_id');
    }

    const mp = getMarketPriceById(mpId);
    if (!mp) throw new HttpError(404, 'Market price entry not found');

    const nextPrice = Number(new_modal_price);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0 || nextPrice > 100000) {
      throw new HttpError(400, 'Modal price must be a positive number up to 100,000 ₹/kg');
    }

    const oldPrice = mp.modal_price_per_kg;
    const diffPct = Math.round(((nextPrice - oldPrice) / Math.max(0.01, oldPrice)) * 100.0 * 10) / 10;
    const trend = diffPct > 0 ? 'rising' : diffPct < 0 ? 'falling' : 'flat';
    const diffStr = diffPct >= 0 ? `+${diffPct}` : `${diffPct}`;

    const farmers = listUsers().filter((u) => u.role === 'farmer');
    const notifications = farmers.map((f) => ({
      user_id: f.id,
      batch_id: null,
      title: `Mandi Price Update: ${mp.crop} at ${mp.mandi}`,
      title_hi: `मंडी भाव अपडेट: ${mp.crop} (${mp.mandi})`,
      message: `Modal price updated to ₹${nextPrice}/kg (${diffStr}% shift). Active batch recommendations recalculated.`,
      message_hi: `नया भाव ₹${nextPrice}/किलो दर्ज हुआ है (${diffStr}% बदलाव)। आपके बैच की संस्तुति अपडेट की गई है।`,
      type: 'price_movement',
      severity: 'medium',
      sent_sms: true
    }));

    const nextMin = Math.min(mp.min_price_per_kg, nextPrice);
    const nextMax = Math.max(mp.max_price_per_kg, nextPrice);

    const updated = updateMarketPriceAndNotifyFarmers(
      mp.id,
      {
        modal_price_per_kg: nextPrice,
        min_price_per_kg: nextMin,
        max_price_per_kg: nextMax,
        trend,
        price_change_pct: diffPct
      },
      notifications
    );

    // Recalculate recommendations for active batches of the updated crop
    const allPrices = listMarketPrices();
    const cropOverride = getCropConstant(updated.crop);
    const altMandi = MarketService.getBestAlternateMarket(updated.crop, '', allPrices);
    const localMandi =
      allPrices.find((m) => m.crop.toLowerCase() === updated.crop.toLowerCase() && m.distance_km <= 80) ||
      null;
    const localPrice =
      localMandi?.modal_price_per_kg ?? cropOverride?.base_fresh_price_per_kg ?? updated.modal_price_per_kg;

    const affectedBatches = listBatches({ status: 'active' }).filter(
      (b) => b.crop.toLowerCase() === updated.crop.toLowerCase()
    );
    const now = new Date();
    for (const batch of affectedBatches) {
      const dt = DecayEngine.computeBatchDigitalTwin({
        crop: batch.crop,
        harvestTime: batch.harvest_time,
        ambientTempC: batch.ambient_temp_c,
        initialQuality: batch.initial_quality,
        currentTime: now,
        cropProfileOverride: cropOverride
      });
      const decCalc = DecisionEngine.evaluateBatchDecision({
        crop: batch.crop,
        quantityKg: batch.quantity_kg,
        currentQuality: dt.current_quality,
        ambientTempC: batch.ambient_temp_c,
        hoursElapsed: dt.hours_elapsed,
        localMandiPricePerKg: localPrice,
        alternateMandiPricePerKg: altMandi.modal_price_per_kg,
        distanceAlternateKm: altMandi.distance_km ?? 140.0,
        cropProfileOverride: cropOverride
      });
      insertRecommendationForBatch(batch.id, {
        recommended_action: decCalc.recommended_action,
        net_value_sell: decCalc.net_values.sell_now,
        net_value_store: decCalc.net_values.store,
        net_value_process: decCalc.net_values.process,
        net_value_redirect: decCalc.net_values.redirect,
        best_expected_value: decCalc.best_expected_value,
        formula_breakdown: decCalc.formula_breakdown,
        explanation_en: decCalc.explanation_en,
        explanation_hi: decCalc.explanation_hi,
        confidence_score: 0.96
      });
    }

    return res.json({
      message: `Mandi price updated to ₹${nextPrice}/kg, ${affectedBatches.length} batch decision(s) recalculated, and alerts broadcast.`,
      crop: updated.crop,
      mandi: updated.mandi,
      new_modal_price: updated.modal_price_per_kg,
      trend: updated.trend,
      recalculated_batches: affectedBatches.length
    });
  } catch (err) {
    next(err);
  }
});

export default router;
