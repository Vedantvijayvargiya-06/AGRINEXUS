function round(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function escapeCsvCell(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class ReportingService {
  static calculateFpoSummary(batches, clusters) {
    const totalBatches = batches.length;
    const totalQuantityKg = batches.reduce((acc, b) => acc + (b.quantity_kg || 0), 0);
    const totalQuantityTonnes = round(totalQuantityKg / 1000.0, 2);

    const totalValueRealized = batches.reduce(
      (acc, b) => acc + (b.realized_value ?? b.best_expected_value ?? 0),
      0
    );

    const baselineLossRate = 0.22;
    const mitigatedLossRate = 0.04;
    const estimatedLossAvoidedValue = round(
      totalValueRealized * (baselineLossRate - mitigatedLossRate),
      2
    );
    const spoilageTonnesPrevented = round(
      totalQuantityTonnes * (baselineLossRate - mitigatedLossRate),
      2
    );

    const totalIndividualFreight = clusters.reduce(
      (acc, c) => acc + (c.individual_cost_total ?? 0),
      0
    );
    const totalPooledFreight = clusters.reduce(
      (acc, c) => acc + (c.pooled_cost_total ?? 0),
      0
    );
    const totalClusteredKg = clusters.reduce(
      (acc, c) => acc + (c.total_quantity_kg ?? 0),
      0
    );
    const totalFreightSavings = Math.max(
      0.0,
      round(totalIndividualFreight - totalPooledFreight, 2)
    );
    const avgFreightSavingsPct =
      totalIndividualFreight > 0
        ? round((totalFreightSavings / totalIndividualFreight) * 100.0, 1)
        : 0.0;
    const avgSoloCostPerKg =
      totalClusteredKg > 0 ? round(totalIndividualFreight / totalClusteredKg, 2) : 0.0;
    const avgPooledCostPerKg =
      totalClusteredKg > 0 ? round(totalPooledFreight / totalClusteredKg, 2) : 0.0;

    const cropDistribution = {};
    for (const b of batches) {
      const c = b.crop || 'Other';
      cropDistribution[c] = (cropDistribution[c] || 0) + (b.quantity_kg || 0);
    }

    const decisionCounts = { sell_now: 0, store: 0, process: 0, redirect: 0 };
    for (const b of batches) {
      const action = b.recommended_action || 'sell_now';
      if (action in decisionCounts) {
        decisionCounts[action] += 1;
      } else {
        decisionCounts.sell_now += 1;
      }
    }

    return {
      total_batches_handled: totalBatches,
      total_produce_kg: totalQuantityKg,
      total_produce_tonnes: totalQuantityTonnes,
      total_value_realized_inr: round(totalValueRealized, 2),
      estimated_loss_avoided_inr: estimatedLossAvoidedValue,
      spoilage_tonnes_prevented: spoilageTonnesPrevented,
      total_freight_savings_inr: totalFreightSavings,
      avg_freight_savings_pct: avgFreightSavingsPct,
      avg_solo_cost_per_kg: avgSoloCostPerKg,
      avg_pooled_cost_per_kg: avgPooledCostPerKg,
      active_clusters_count: clusters.length,
      crop_distribution: cropDistribution,
      decision_distribution: decisionCounts,
      generated_at: new Date().toISOString()
    };
  }

  static generateCsvReport(batches) {
    const header = [
      'Batch Code',
      'Farmer Name',
      'Crop',
      'Quantity (kg)',
      'Harvest Date',
      'Location',
      'Quality (%)',
      'Shelf Life (hrs)',
      'Spoilage Risk (%)',
      'Recommended Action',
      'Expected Value (INR)',
      'Status'
    ]
      .map(escapeCsvCell)
      .join(',');

    const rows = batches.map((b) =>
      [
        b.batch_code || '',
        b.farmer_name || 'Farmer',
        b.crop || '',
        b.quantity_kg || 0,
        b.harvest_time || '',
        b.location || '',
        b.current_quality || 0,
        b.shelf_life_hrs || 0,
        b.spoilage_risk || 0,
        b.recommended_action || '',
        b.best_expected_value || 0,
        b.status || ''
      ]
        .map(escapeCsvCell)
        .join(',')
    );

    return [header, ...rows].join('\n');
  }
}
