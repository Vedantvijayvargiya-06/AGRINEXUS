import { Router } from 'express';
import {
  getBatchById,
  getCropConstant,
  getLatestRecommendation,
  listMarketPrices
} from '../store.js';
import { DecayEngine } from '../services/decayEngine.js';
import { DecisionEngine } from '../services/decisionEngine.js';
import { MarketService } from '../services/marketService.js';
import { requireAuth, HttpError } from '../security.js';

const router = Router();

router.get('/batch/:batchId', requireAuth, (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      throw new HttpError(400, 'Invalid batch ID');
    }

    const batch = getBatchById(batchId);
    if (!batch) throw new HttpError(404, 'Batch not found');

    if (req.currentUser.role === 'farmer' && batch.farmer_id !== req.currentUser.id) {
      throw new HttpError(403, 'Access denied: you can only view your own batch decisions');
    }

    const rec = getLatestRecommendation(batch.id);
    if (!rec) {
      const marketFeed = listMarketPrices();
      const altMandi = MarketService.getBestAlternateMarket(batch.crop, '', marketFeed);
      const cropOverride = getCropConstant(batch.crop);
      return res.json(
        DecisionEngine.evaluateBatchDecision({
          crop: batch.crop,
          quantityKg: batch.quantity_kg,
          currentQuality: batch.current_quality,
          ambientTempC: batch.ambient_temp_c,
          hoursElapsed: batch.shelf_life_hrs,
          localMandiPricePerKg: cropOverride?.base_fresh_price_per_kg ?? 26.5,
          alternateMandiPricePerKg: altMandi.modal_price_per_kg,
          cropProfileOverride: cropOverride
        })
      );
    }

    return res.json({
      batch_id: batch.id,
      batch_code: batch.batch_code,
      crop: batch.crop,
      recommended_action: rec.recommended_action,
      best_expected_value: rec.best_expected_value,
      net_values: {
        sell_now: rec.net_value_sell,
        store: rec.net_value_store,
        process: rec.net_value_process,
        redirect: rec.net_value_redirect
      },
      formula_breakdown: rec.formula_breakdown,
      explanation_en: rec.explanation_en,
      explanation_hi: rec.explanation_hi,
      confidence_score: rec.confidence_score,
      generated_at: new Date(rec.generated_at).toISOString()
    });
  } catch (err) {
    next(err);
  }
});

router.post('/simulate', requireAuth, (req, res, next) => {
  try {
    const p = req.body || {};
    const crop = String(p.crop || 'Tomato').trim();
    const cropOverride = getCropConstant(crop);

    const qty = Number(p.quantity_kg ?? 1200.0);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1000000) {
      throw new HttpError(400, 'Simulated quantity must be between 1 and 1,000,000 kg');
    }

    const baseQuality = Number(p.current_quality ?? 85.0);
    if (!Number.isFinite(baseQuality) || baseQuality < 0 || baseQuality > 100) {
      throw new HttpError(400, 'Current quality must be between 0% and 100%');
    }

    const ambientTempC = Number(p.ambient_temp_c ?? 28.0);
    if (!Number.isFinite(ambientTempC) || ambientTempC < -20 || ambientTempC > 65) {
      throw new HttpError(400, 'Ambient temperature must be between -20°C and 65°C');
    }

    const delayHours = Math.max(0, Math.min(240, Number(p.transport_delay_hours ?? 0.0) || 0));
    const hoursElapsed = Math.max(0, Number(p.hours_elapsed ?? 24.0) || 0) + delayHours;

    const localPrice = Number(p.local_mandi_price_per_kg ?? 26.5);
    const altPrice = Number(p.alternate_mandi_price_per_kg ?? 42.0);
    if (!Number.isFinite(localPrice) || localPrice < 0 || !Number.isFinite(altPrice) || altPrice < 0) {
      throw new HttpError(400, 'Mandi prices must be non-negative numbers');
    }

    const storageDays = parseInt(p.storage_days ?? 7, 10);
    if (!Number.isInteger(storageDays) || storageDays < 1 || storageDays > 90) {
      throw new HttpError(400, 'Storage days must be between 1 and 90');
    }

    // Reflect additional transit delay & ambient temperature impact on effective quality
    const q10 = cropOverride?.q10_factor ?? 2.0;
    const baseLife = cropOverride?.base_shelf_life_hours ?? 144.0;
    const effectiveLife = DecayEngine.computeEffectiveShelfLife(baseLife, ambientTempC, q10);
    const simulatedQuality =
      delayHours > 0
        ? DecayEngine.computeQuality(delayHours, effectiveLife, baseQuality)
        : baseQuality;

    const calcRes = DecisionEngine.evaluateBatchDecision({
      crop,
      quantityKg: qty,
      currentQuality: simulatedQuality,
      ambientTempC,
      hoursElapsed,
      localMandiPricePerKg: localPrice,
      alternateMandiPricePerKg: altPrice,
      storageDays,
      projectedPriceIncreasePct: Number(p.projected_price_surge_pct ?? 15.0),
      isPooled: Boolean(p.is_pooled ?? false),
      cropProfileOverride: cropOverride
    });

    res.json(calcRes);
  } catch (err) {
    next(err);
  }
});

export default router;
