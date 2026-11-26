import { Router } from 'express';
import crypto from 'crypto';
import {
  getBatchById,
  getCropConstant,
  getLatestRecommendation,
  listMarketPrices,
  createEscalation
} from '../store.js';
import { AgriNexusAssist } from '../services/agrinexusAssist.js';
import { DecayEngine } from '../services/decayEngine.js';
import { requireAuth, HttpError } from '../security.js';

const router = Router();

router.post('/chat', requireAuth, (req, res, next) => {
  try {
    const { query, batch_id = null, language = 'en' } = req.body || {};
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) {
      throw new HttpError(400, 'Query cannot be empty');
    }

    let batchCtx = null;

    if (batch_id) {
      const batchId = Number(batch_id);
      if (!Number.isInteger(batchId) || batchId <= 0) {
        throw new HttpError(400, 'Invalid batch_id');
      }
      const batch = getBatchById(batchId);
      if (batch) {
        if (req.currentUser.role === 'farmer' && batch.farmer_id !== req.currentUser.id) {
          throw new HttpError(403, 'Access denied: you can only ask about your own batches');
        }

        const cropOverride = getCropConstant(batch.crop);
        const dt = DecayEngine.computeBatchDigitalTwin({
          crop: batch.crop,
          harvestTime: batch.harvest_time,
          ambientTempC: batch.ambient_temp_c,
          initialQuality: batch.initial_quality,
          cropProfileOverride: cropOverride
        });
        const rec = getLatestRecommendation(batch.id);
        const recAction = rec ? rec.recommended_action : 'sell_now';

        batchCtx = {
          id: batch.id,
          batch_code: batch.batch_code,
          crop: batch.crop,
          crop_name_hi: dt.crop_name_hi,
          quantity_kg: batch.quantity_kg,
          current_quality: dt.current_quality,
          spoilage_risk: dt.spoilage_risk,
          remaining_shelf_life_hrs: dt.remaining_shelf_life_hrs,
          remaining_shelf_life_days: dt.remaining_shelf_life_days,
          recommendation: {
            recommended_action: recAction,
            recommended_title:
              recAction === 'redirect'
                ? 'Redirect to Terminal Market'
                : recAction === 'store'
                  ? 'Store in Cold Storage'
                  : recAction === 'process'
                    ? 'FPO / Local Secondary Processing'
                    : 'Sell in Local Mandi',
            recommended_title_hi:
              recAction === 'redirect'
                ? 'टर्मिनल मंडी में भेजें'
                : recAction === 'store'
                  ? 'कोल्ड स्टोरेज में रखें'
                  : recAction === 'process'
                    ? 'एफपीओ / स्थानीय प्रसंस्करण इकाई को भेजें'
                    : 'स्थानीय मंडी में बेचें',
            best_expected_value: rec ? rec.best_expected_value : 0.0,
            explanation_en: rec ? rec.explanation_en : '',
            explanation_hi: rec ? rec.explanation_hi : ''
          }
        };
      }
    }

    const marketCtx = listMarketPrices()
      .slice(0, 5)
      .map((mp) => ({
        crop: mp.crop,
        mandi: mp.mandi,
        modal_price_per_kg: mp.modal_price_per_kg,
        trend: mp.trend,
        arrivals_tonnes: mp.arrivals_tonnes
      }));

    const response = AgriNexusAssist.answerQuery({
      query: cleanQuery.slice(0, 1000),
      userLang: language === 'hi' ? 'hi' : 'en',
      batchContext: batchCtx,
      marketContext: marketCtx
    });

    return res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/escalate-helpdesk', requireAuth, (req, res, next) => {
  try {
    const { batch_id = null, issue_topic = 'Post-Harvest Decision Escalation', query_text = '' } =
      req.body || {};

    let validBatchId = null;
    if (batch_id !== null && batch_id !== undefined && batch_id !== '') {
      const parsed = Number(batch_id);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new HttpError(400, 'Invalid batch_id');
      }
      const batch = getBatchById(parsed);
      if (batch) {
        if (req.currentUser.role === 'farmer' && batch.farmer_id !== req.currentUser.id) {
          throw new HttpError(403, 'Access denied');
        }
        validBatchId = batch.id;
      }
    }

    const suffix = crypto.randomInt(1000, 10000);
    const ticketId = `TICKET-FPO-${req.currentUser.id}-${suffix}`;
    createEscalation({
      ticket_id: ticketId,
      user_id: req.currentUser.id,
      batch_id: validBatchId,
      issue_topic: String(issue_topic || 'Post-Harvest Decision Escalation').slice(0, 160),
      query_text: String(query_text || '').slice(0, 1000)
    });

    res.json({
      status: 'success',
      ticket_id: ticketId,
      message:
        'Your query has been assigned to an FPO Agronomist / Market Specialist. They will call you at your registered mobile number shortly.',
      message_hi:
        'आपका प्रश्न एफपीओ कृषि विशेषज्ञ को भेज दिया गया है। वे शीघ्र ही आपके पंजीकृत मोबाइल नंबर पर संपर्क करेंगे।',
      fpo_helpdesk_number: '+91 80 2345 6789 (Toll-Free Kisan Helpdesk)'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
