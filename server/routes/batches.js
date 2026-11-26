import { Router } from 'express';
import crypto from 'crypto';
import {
  listBatches,
  getBatchById,
  batchCodeExists,
  createBatchWithTwinAndRec,
  createOutcomeAndCompleteBatch,
  updateBatchStatus,
  getCropConstant,
  getLatestRecommendation,
  getUserById,
  listMarketPrices
} from '../store.js';
import { DecayEngine, DEFAULT_CROP_PROFILES } from '../services/decayEngine.js';
import { DecisionEngine } from '../services/decisionEngine.js';
import { MarketService } from '../services/marketService.js';
import { requireAuth, HttpError } from '../security.js';

const router = Router();
const VALID_ACTIONS = new Set(['sell_now', 'store', 'process', 'redirect']);

function parsePositiveId(raw, label = 'batch ID') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  return id;
}

router.get('', requireAuth, (req, res, next) => {
  try {
    const status = String(req.query.status || 'all');
    const farmerFilter = req.currentUser.role === 'farmer' ? req.currentUser.id : null;
    const batches = listBatches({ farmerId: farmerFilter, status });

    const now = new Date();
    const results = batches.map((b) => {
      const cropOverride = getCropConstant(b.crop);
      const dt = DecayEngine.computeBatchDigitalTwin({
        crop: b.crop,
        harvestTime: b.harvest_time,
        ambientTempC: b.ambient_temp_c,
        initialQuality: b.initial_quality,
        currentTime: now,
        cropProfileOverride: cropOverride
      });

      const farmer = getUserById(b.farmer_id);
      const rec = getLatestRecommendation(b.id);

      return {
        id: b.id,
        batch_code: b.batch_code,
        farmer_id: b.farmer_id,
        farmer_name: farmer ? farmer.name : 'Farmer',
        farmer_phone: farmer ? farmer.phone : '',
        crop: b.crop,
        crop_name_hi: dt.crop_name_hi,
        variety: b.variety,
        quantity_kg: b.quantity_kg,
        harvest_time: new Date(b.harvest_time).toISOString(),
        location: b.location,
        locality: b.locality,
        ambient_temp_c: b.ambient_temp_c,
        storage_type: b.storage_type,
        current_quality: dt.current_quality,
        shelf_life_hrs: dt.remaining_shelf_life_hrs,
        shelf_life_days: dt.remaining_shelf_life_days,
        spoilage_risk: dt.spoilage_risk,
        risk_level: dt.risk_level,
        risk_label: dt.risk_label,
        risk_label_hi: dt.risk_label_hi,
        risk_color: dt.risk_color,
        risk_bg_class: dt.risk_bg_class,
        alert_banner: dt.alert_banner,
        status: b.status,
        cluster_id: b.cluster_id,
        photo_url: b.photo_url,
        recommendation: rec
          ? {
              action: rec.recommended_action,
              expected_value: rec.best_expected_value,
              net_values: {
                sell_now: rec.net_value_sell,
                store: rec.net_value_store,
                process: rec.net_value_process,
                redirect: rec.net_value_redirect
              },
              explanation_en: rec.explanation_en,
              explanation_hi: rec.explanation_hi
            }
          : null
      };
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.get('/:batchId', requireAuth, (req, res, next) => {
  try {
    const batchId = parsePositiveId(req.params.batchId);
    const batch = getBatchById(batchId);
    if (!batch) throw new HttpError(404, 'Batch not found');

    if (req.currentUser.role === 'farmer' && batch.farmer_id !== req.currentUser.id) {
      throw new HttpError(403, 'Access denied: you can only view your own batches');
    }

    const now = new Date();
    const cropOverride = getCropConstant(batch.crop);
    const dt = DecayEngine.computeBatchDigitalTwin({
      crop: batch.crop,
      harvestTime: batch.harvest_time,
      ambientTempC: batch.ambient_temp_c,
      initialQuality: batch.initial_quality,
      currentTime: now,
      cropProfileOverride: cropOverride
    });

    const farmer = getUserById(batch.farmer_id);
    const rec = getLatestRecommendation(batch.id);

    res.json({
      id: batch.id,
      batch_code: batch.batch_code,
      farmer_id: batch.farmer_id,
      farmer_name: farmer ? farmer.name : 'Farmer',
      crop: batch.crop,
      crop_name_hi: dt.crop_name_hi,
      variety: batch.variety,
      quantity_kg: batch.quantity_kg,
      harvest_time: new Date(batch.harvest_time).toISOString(),
      location: batch.location,
      locality: batch.locality,
      ambient_temp_c: batch.ambient_temp_c,
      storage_type: batch.storage_type,
      initial_quality: batch.initial_quality,
      digital_twin: dt,
      recommendation: rec
        ? {
            action: rec.recommended_action,
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
            confidence_score: rec.confidence_score
          }
        : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('', requireAuth, (req, res, next) => {
  try {
    const payload = req.body || {};
    const now = new Date();
    const harvestDt = payload.harvest_time ? new Date(payload.harvest_time) : new Date();

    if (Number.isNaN(harvestDt.getTime())) {
      throw new HttpError(400, 'Invalid harvest time');
    }
    if (harvestDt.getTime() > now.getTime() + 10 * 60000) {
      throw new HttpError(400, 'Harvest time cannot be in the future');
    }
    if (harvestDt.getTime() < now.getTime() - 365 * 86400000) {
      throw new HttpError(400, 'Harvest time cannot be older than 365 days');
    }

    const supportedCrops = Object.keys(DEFAULT_CROP_PROFILES);
    const cropInput = String(payload.crop || 'Tomato').trim();
    const cropMatch = supportedCrops.find((c) => c.toLowerCase() === cropInput.toLowerCase());
    if (!cropMatch) {
      throw new HttpError(
        400,
        `Unsupported crop '${payload.crop}'. Supported crops: ${supportedCrops.join(', ')}`
      );
    }

    const qty = Number(payload.quantity_kg);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new HttpError(400, 'Quantity must be greater than 0 kg');
    }
    if (qty > 1000000) {
      throw new HttpError(400, 'Quantity cannot exceed 1,000,000 kg');
    }

    const temp = Number(payload.ambient_temp_c ?? 28.0);
    if (!Number.isFinite(temp) || temp < -20.0 || temp > 65.0) {
      throw new HttpError(400, 'Ambient temperature must be between -20°C and 65°C');
    }

    const farmerId = req.currentUser.id;
    const prefix = cropMatch.slice(0, 3).toUpperCase();
    let code;
    do {
      code = `BATCH-${prefix}-${crypto.randomInt(100, 10000)}`;
    } while (batchCodeExists(code));

    const cropOverride = getCropConstant(cropMatch);
    const dt = DecayEngine.computeBatchDigitalTwin({
      crop: cropMatch,
      harvestTime: harvestDt,
      ambientTempC: temp,
      initialQuality: 98.0,
      currentTime: now,
      cropProfileOverride: cropOverride
    });

    const marketFeed = listMarketPrices();
    const altMandi = MarketService.getBestAlternateMarket(cropMatch, '', marketFeed);
    const localMandi =
      marketFeed.find((m) => m.crop.toLowerCase() === cropMatch.toLowerCase() && m.distance_km <= 80) ||
      null;
    const localPrice =
      localMandi?.modal_price_per_kg ??
      cropOverride?.base_fresh_price_per_kg ??
      (cropMatch === 'Tomato' ? 26.5 : 30.0);

    const decCalc = DecisionEngine.evaluateBatchDecision({
      crop: cropMatch,
      quantityKg: qty,
      currentQuality: dt.current_quality,
      ambientTempC: temp,
      hoursElapsed: dt.hours_elapsed,
      localMandiPricePerKg: localPrice,
      alternateMandiPricePerKg: altMandi.modal_price_per_kg,
      distanceAlternateKm: altMandi.distance_km ?? 140.0,
      cropProfileOverride: cropOverride
    });

    const notifData =
      dt.spoilage_risk >= 70.0
        ? {
            user_id: farmerId,
            title: `CRITICAL SPOILAGE ALERT (${Math.round(dt.spoilage_risk)}%) - ${code}`,
            title_hi: `अत्यधिक सड़न जोखिम चेतावनी (${Math.round(dt.spoilage_risk)}%): ${code}`,
            message: `High ambient temperature is accelerating spoilage. Recommended immediate action: ${decCalc.recommended_title}.`,
            message_hi: `तापमान के कारण फसल शीघ्र खराब हो सकती है। संस्तुत कार्यवाही: ${decCalc.recommended_title_hi}.`,
            type: 'spoilage_alert',
            severity: 'critical',
            sent_sms: true
          }
        : null;

    const newBatch = createBatchWithTwinAndRec(
      {
        batch_code: code,
        farmer_id: farmerId,
        crop: cropMatch,
        variety: String(payload.variety || 'Standard Hybrid').trim().slice(0, 120) || 'Standard Hybrid',
        quantity_kg: qty,
        harvest_time: harvestDt,
        location: String(payload.location || 'Farm Gate').trim().slice(0, 160) || 'Farm Gate',
        locality: String(payload.locality || 'Kolar').trim().slice(0, 100) || 'Kolar',
        ambient_temp_c: temp,
        storage_type: String(payload.storage_type || 'Ambient Farm Shed').trim().slice(0, 100),
        initial_quality: 98.0,
        current_quality: dt.current_quality,
        shelf_life_hrs: dt.remaining_shelf_life_hrs,
        spoilage_risk: dt.spoilage_risk,
        photo_url:
          typeof payload.photo_url === 'string' &&
          (payload.photo_url.startsWith('https://') || payload.photo_url.startsWith('data:image/'))
            ? payload.photo_url.slice(0, 500000)
            : null
      },
      {
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
      },
      notifData
    );

    return res.status(201).json({
      message: 'Batch registered successfully with Digital Twin generated',
      batch_id: newBatch.id,
      batch_code: newBatch.batch_code,
      digital_twin: dt,
      recommendation: decCalc
    });
  } catch (err) {
    next(err);
  }
});

router.post('/confirm-outcome', requireAuth, (req, res, next) => {
  try {
    const { batch_id, actual_action, actual_value_realised, feedback_notes = null } = req.body || {};
    const batchId = parsePositiveId(batch_id);
    const batch = getBatchById(batchId);
    if (!batch) throw new HttpError(404, 'Batch not found');

    if (req.currentUser.role === 'farmer' && batch.farmer_id !== req.currentUser.id) {
      throw new HttpError(403, 'Access denied: you can only confirm outcomes for your own batches');
    }

    const actionClean = String(actual_action || '').trim();
    if (!VALID_ACTIONS.has(actionClean)) {
      throw new HttpError(400, 'Invalid action specified');
    }

    const realised = Number(actual_value_realised);
    if (!Number.isFinite(realised) || realised < 0) {
      throw new HttpError(400, 'Actual value realised must be a non-negative number');
    }

    const rec = getLatestRecommendation(batch.id);
    const predictedVal = rec ? rec.best_expected_value : realised;
    const errorPct =
      Math.round(
        (Math.abs(realised - predictedVal) / Math.max(1.0, predictedVal)) * 100.0 * 100
      ) / 100;

    createOutcomeAndCompleteBatch({
      batch_id: batch.id,
      actual_action: actionClean,
      predicted_action: rec ? rec.recommended_action : actionClean,
      actual_value_realised: realised,
      predicted_value: predictedVal,
      error_pct: errorPct,
      feedback_notes: feedback_notes ? String(feedback_notes).slice(0, 500) : null
    });

    return res.json({
      message: 'Outcome logged successfully to ML feedback training loop',
      error_pct: errorPct,
      actual_value_realised: realised
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:batchId/archive', requireAuth, (req, res, next) => {
  try {
    const batchId = parsePositiveId(req.params.batchId);
    const batch = getBatchById(batchId);
    if (!batch) throw new HttpError(404, 'Batch not found');

    if (req.currentUser.role === 'farmer' && batch.farmer_id !== req.currentUser.id) {
      throw new HttpError(403, 'Access denied');
    }

    updateBatchStatus(batchId, 'archived');
    return res.json({ message: `Batch ${batch.batch_code} archived` });
  } catch (err) {
    next(err);
  }
});

export default router;
