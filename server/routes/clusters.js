import { Router } from 'express';
import crypto from 'crypto';
import {
  listClusters,
  getClusterById,
  listBatches,
  listBatchesInCluster,
  createClusterWithBatches,
  confirmClusterAndNotify,
  getUserById
} from '../store.js';
import { ClusterOptimizer } from '../services/clusterOptimizer.js';
import { requireAuth, requireRole, HttpError } from '../security.js';

const router = Router();

router.get('', requireAuth, (req, res) => {
  const status = req.query.status;
  const clusters = listClusters(status);

  const results = clusters.map((c) => {
    const batchesInCluster = listBatchesInCluster(c.id);
    const batchList = batchesInCluster.map((b) => {
      const farmer = getUserById(b.farmer_id);
      return {
        id: b.id,
        batch_code: b.batch_code,
        farmer_name: farmer ? farmer.name : 'Farmer',
        farmer_phone: farmer ? farmer.phone : '',
        quantity_kg: b.quantity_kg,
        quality: b.current_quality,
        spoilage_risk: b.spoilage_risk
      };
    });

    return {
      id: c.id,
      cluster_code: c.cluster_code,
      crop: c.crop,
      locality: c.locality,
      destination_mandi: c.destination_mandi,
      total_quantity_kg: c.total_quantity_kg,
      individual_transport_cost_per_kg: c.individual_transport_cost_per_kg,
      pooled_transport_cost_per_kg: c.pooled_transport_cost_per_kg,
      cost_savings_pct: c.cost_savings_pct,
      vehicle_type: c.vehicle_type,
      capacity_utilization_pct: c.capacity_utilization_pct,
      status: c.status,
      created_at: new Date(c.created_at).toISOString(),
      batches_count: batchList.length,
      batches: batchList
    };
  });

  res.json(results);
});

router.post('/optimize-candidates', requireRole('fpo_admin', 'admin'), (req, res) => {
  const cropFilter = req.query.crop ? String(req.query.crop).trim() : '';
  const localityFilter = req.query.locality ? String(req.query.locality).trim() : '';

  const unclusteredActive = listBatches({ status: 'active' }).filter((b) => {
    if (b.cluster_id) return false;
    if (b.spoilage_risk >= 70.0) return false;
    if (cropFilter && cropFilter.toLowerCase() !== 'all' && b.crop.toLowerCase() !== cropFilter.toLowerCase()) {
      return false;
    }
    if (
      localityFilter &&
      localityFilter.toLowerCase() !== 'all' &&
      !String(b.locality || '').toLowerCase().includes(localityFilter.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  if (unclusteredActive.length === 0) {
    return res.json({
      message: 'No unclustered active low-risk batches available for new candidate clustering.',
      created_count: 0,
      candidates: []
    });
  }

  // Group unclustered batches by crop so different crops are never mixed in the same dispatch
  const groups = new Map();
  for (const b of unclusteredActive) {
    const key = b.crop;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }

  const created = [];
  for (const [cropName, groupBatches] of groups.entries()) {
    const batchDicts = groupBatches.map((b) => {
      const farmer = getUserById(b.farmer_id);
      return {
        id: b.id,
        batch_code: b.batch_code,
        farmer_id: b.farmer_id,
        farmer_name: farmer ? farmer.name : 'Farmer',
        quantity_kg: b.quantity_kg
      };
    });

    const optResult = ClusterOptimizer.evaluateClusterFreightSavings(batchDicts, 140.0);
    const groupLocality = localityFilter || groupBatches[0]?.locality || 'Kolar';
    const locPrefix = groupLocality.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'LOC';
    const code = `CLUS-${cropName.slice(0, 3).toUpperCase()}-${locPrefix}-${crypto.randomInt(100, 1000)}`;

    const newCluster = createClusterWithBatches(
      {
        cluster_code: code,
        crop: cropName,
        locality: `${groupLocality} Cluster Area`,
        destination_mandi: 'Azadpur Mandi, Delhi',
        total_quantity_kg: optResult.total_quantity_kg,
        individual_transport_cost_per_kg: optResult.individual_cost_per_kg,
        pooled_transport_cost_per_kg: optResult.pooled_cost_per_kg,
        cost_savings_pct: optResult.savings_pct,
        vehicle_type: optResult.vehicle_type,
        capacity_utilization_pct: optResult.capacity_utilization_pct
      },
      groupBatches.map((b) => b.id)
    );

    created.push({
      cluster_id: newCluster.id,
      cluster_code: newCluster.cluster_code,
      crop: cropName,
      batches_count: groupBatches.length,
      optimization: optResult
    });
  }

  return res.json({
    message: `Created ${created.length} candidate cluster(s) from ${unclusteredActive.length} unclustered lot(s).`,
    created_count: created.length,
    cluster_id: created[0]?.cluster_id,
    cluster_code: created[0]?.cluster_code,
    optimization: created[0]?.optimization,
    candidates: created
  });
});

router.post('/confirm', requireRole('fpo_admin', 'admin'), (req, res, next) => {
  try {
    const { cluster_id, destination_mandi = 'Azadpur Mandi, Delhi' } = req.body || {};
    const clusterId = Number(cluster_id);
    if (!Number.isInteger(clusterId) || clusterId <= 0) {
      throw new HttpError(400, 'Invalid cluster ID');
    }
    const cluster = getClusterById(clusterId);
    if (!cluster) throw new HttpError(404, 'Cluster not found');
    if (cluster.status === 'confirmed') {
      throw new HttpError(400, 'Cluster is already confirmed');
    }

    const now = new Date();
    const dispatchDate = new Date(now.getTime() + 14 * 3600000);
    const targetMandi = String(destination_mandi || cluster.destination_mandi).trim().slice(0, 160);

    const batches = listBatchesInCluster(cluster.id);
    const notifications = [];
    const notifiedFarmers = [];

    for (const b of batches) {
      if (b.farmer_id) {
        notifications.push({
          user_id: b.farmer_id,
          batch_id: b.id,
          title: `Pooling Cluster Confirmed: ${cluster.cluster_code}`,
          title_hi: `क्लस्टर पूलिंग स्वीकृत: ${cluster.cluster_code}`,
          message: `Your batch ${b.batch_code} (${b.quantity_kg}kg) is confirmed for shared transport to ${targetMandi}. Transport rate: ₹${cluster.pooled_transport_cost_per_kg}/kg (Saved ${cluster.cost_savings_pct}%!). Dispatch: Tomorrow 6:00 AM.`,
          message_hi: `आपका ${b.crop} बैच (${b.quantity_kg} किलो) ${targetMandi} के लिए संयुक्त वाहन में शामिल कर लिया गया है। भाड़ा दर: मात्र ₹${cluster.pooled_transport_cost_per_kg}/किलो (बचत ${cluster.cost_savings_pct}%)! रवानगी: कल सुबह 6:00 बजे।`,
          type: 'cluster_invite',
          severity: 'medium',
          sent_sms: true
        });
        notifiedFarmers.push(b.farmer_id);
      }
    }

    const updated = confirmClusterAndNotify(
      cluster.id,
      req.currentUser.id,
      dispatchDate,
      targetMandi,
      notifications
    );

    return res.json({
      message: `Cluster ${updated.cluster_code} confirmed successfully. SMS dispatched to ${new Set(notifiedFarmers).size} member farmers.`,
      cluster_code: updated.cluster_code,
      status: updated.status,
      dispatch_date: updated.dispatch_date.toISOString(),
      total_kg: updated.total_quantity_kg
    });
  } catch (err) {
    next(err);
  }
});

export default router;
