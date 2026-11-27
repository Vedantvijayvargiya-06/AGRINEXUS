import { Router } from 'express';
import {
  listBatches,
  listClusters,
  getLatestRecommendation,
  getUserById
} from '../store.js';
import { ReportingService } from '../services/reportingService.js';
import { requireRole } from '../security.js';

const router = Router();

router.get('/summary', requireRole('fpo_admin', 'admin'), (req, res) => {
  const batches = listBatches({ status: 'all' });
  const clusters = listClusters('all');

  const batchDicts = batches.map((b) => {
    const rec = getLatestRecommendation(b.id);
    return {
      id: b.id,
      batch_code: b.batch_code,
      crop: b.crop,
      quantity_kg: b.quantity_kg,
      harvest_time: new Date(b.harvest_time).toISOString(),
      location: b.location,
      current_quality: b.current_quality,
      shelf_life_hrs: b.shelf_life_hrs,
      spoilage_risk: b.spoilage_risk,
      status: b.status,
      recommended_action: rec ? rec.recommended_action : 'sell_now',
      best_expected_value: rec ? rec.best_expected_value : b.quantity_kg * 25.0
    };
  });

  const clusterDicts = clusters.map((c) => ({
    id: c.id,
    cluster_code: c.cluster_code,
    total_quantity_kg: c.total_quantity_kg,
    individual_cost_total: c.individual_transport_cost_per_kg * c.total_quantity_kg,
    pooled_cost_total: c.pooled_transport_cost_per_kg * c.total_quantity_kg
  }));

  res.json(ReportingService.calculateFpoSummary(batchDicts, clusterDicts));
});

router.get('/export/csv', requireRole('fpo_admin', 'admin'), (req, res) => {
  const batches = listBatches({ status: 'all' });

  const batchDicts = batches.map((b) => {
    const rec = getLatestRecommendation(b.id);
    const farmer = getUserById(b.farmer_id);
    const dt = new Date(b.harvest_time);
    const formattedDt = `${dt.toISOString().slice(0, 10)} ${dt.toISOString().slice(11, 16)}`;
    return {
      batch_code: b.batch_code,
      farmer_name: farmer ? farmer.name : 'Farmer',
      crop: b.crop,
      quantity_kg: b.quantity_kg,
      harvest_time: formattedDt,
      location: b.location,
      current_quality: b.current_quality,
      shelf_life_hrs: b.shelf_life_hrs,
      spoilage_risk: b.spoilage_risk,
      recommended_action: rec ? rec.recommended_action : 'sell_now',
      best_expected_value: rec ? rec.best_expected_value : 0,
      status: b.status
    };
  });

  const csvData = ReportingService.generateCsvReport(batchDicts);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=agrinexus_post_harvest_report.csv');
  res.send(csvData);
});

export default router;
