import { Router } from 'express';
import {
  listMarketPrices,
  getMarketPriceById,
  updateMarketPriceAndNotifyFarmers,
  listUsers
} from '../store.js';
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
      message: `Modal price updated to ₹${nextPrice}/kg (${diffStr}% shift). Recalculating your batch decisions.`,
      message_hi: `नया भाव ₹${nextPrice}/किलो दर्ज हुआ है (${diffStr}% बदलाव)। आपके बैच की संस्तुति अपडेट की जा रही है।`,
      type: 'price_movement',
      severity: 'medium',
      sent_sms: true
    }));

    const updated = updateMarketPriceAndNotifyFarmers(
      mp.id,
      {
        modal_price_per_kg: nextPrice,
        trend,
        price_change_pct: diffPct
      },
      notifications
    );

    return res.json({
      message: `Mandi price updated to ₹${nextPrice}/kg and alerts broadcast.`,
      crop: updated.crop,
      mandi: updated.mandi,
      new_modal_price: updated.modal_price_per_kg,
      trend: updated.trend
    });
  } catch (err) {
    next(err);
  }
});

export default router;
