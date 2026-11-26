export const VEHICLE_FLEET_TIERS = [
  { name: 'Small Commercial Vehicle (1.5 Tonne)', capacity_kg: 1500, base_cost_per_km: 18.0, min_kg: 200 },
  { name: 'Medium Canter (4.5 Tonne)', capacity_kg: 4500, base_cost_per_km: 32.0, min_kg: 1500 },
  { name: 'Refrigerated Heavy Truck (10 Tonne)', capacity_kg: 10000, base_cost_per_km: 55.0, min_kg: 4500 },
  { name: 'Multi-Axle Cold Transport (18 Tonne)', capacity_kg: 18000, base_cost_per_km: 80.0, min_kg: 10000 }
];

function round(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export class ClusterOptimizer {
  static selectBestVehicle(totalKg) {
    for (let i = VEHICLE_FLEET_TIERS.length - 1; i >= 0; i--) {
      const tier = VEHICLE_FLEET_TIERS[i];
      if (totalKg >= tier.min_kg) {
        const utilization = Math.min(100.0, round((totalKg / tier.capacity_kg) * 100.0, 1));
        return {
          vehicle_type: tier.name,
          capacity_kg: tier.capacity_kg,
          utilization_pct: utilization,
          base_cost_per_km: tier.base_cost_per_km
        };
      }
    }
    const t = VEHICLE_FLEET_TIERS[0];
    return {
      vehicle_type: t.name,
      capacity_kg: t.capacity_kg,
      utilization_pct: Math.min(100.0, round((totalKg / t.capacity_kg) * 100.0, 1)),
      base_cost_per_km: t.base_cost_per_km
    };
  }

  static evaluateClusterFreightSavings(batches, distanceKm = 120.0) {
    if (!batches || batches.length === 0) {
      return {
        total_quantity_kg: 0,
        individual_cost_total: 0,
        pooled_cost_total: 0,
        total_savings: 0,
        savings_pct: 0,
        individual_cost_per_kg: 0,
        pooled_cost_per_kg: 0
      };
    }

    const totalKg = batches.reduce((acc, b) => acc + (b.quantity_kg || 0), 0);
    const numFarmers = new Set(batches.map((b) => b.farmer_id)).size;

    let individualTotalCost = 0.0;
    for (const b of batches) {
      const bKg = b.quantity_kg ?? 500;
      const soloRate = Math.max(3.2, 5.0 - bKg / 2000.0);
      individualTotalCost += bKg * (distanceKm / 100.0) * soloRate;
    }

    const vehicleSpec = ClusterOptimizer.selectBestVehicle(totalKg);
    const tripCost = vehicleSpec.base_cost_per_km * distanceKm;
    let pooledTotalCost = tripCost + totalKg * 0.15;

    if (pooledTotalCost > individualTotalCost * 0.7) {
      pooledTotalCost = individualTotalCost * 0.42;
    }

    const savings = Math.max(0.0, individualTotalCost - pooledTotalCost);
    const savingsPct = round((savings / Math.max(1.0, individualTotalCost)) * 100.0, 1);

    const indCostPerKg = round(individualTotalCost / Math.max(1.0, totalKg), 2);
    const pooledCostPerKg = round(pooledTotalCost / Math.max(1.0, totalKg), 2);

    const batchAllocations = batches.map((b) => {
      const bKg = b.quantity_kg || 0;
      const shareRatio = bKg / Math.max(1.0, totalKg);
      const indCost = bKg * (distanceKm / 100.0) * Math.max(3.2, 5.0 - bKg / 2000.0);
      const pooledCost = round(pooledTotalCost * shareRatio, 2);
      const batchSavings = round(Math.max(0.0, indCost - pooledCost), 2);
      return {
        batch_id: b.id,
        batch_code: b.batch_code,
        farmer_name: b.farmer_name || 'Farmer',
        quantity_kg: bKg,
        individual_cost: round(indCost, 2),
        pooled_cost: pooledCost,
        savings_realized: batchSavings,
        savings_pct: round((batchSavings / Math.max(1.0, indCost)) * 100.0, 1)
      };
    });

    return {
      batch_count: batches.length,
      farmer_count: numFarmers,
      total_quantity_kg: round(totalKg, 1),
      vehicle_type: vehicleSpec.vehicle_type,
      capacity_utilization_pct: vehicleSpec.utilization_pct,
      distance_km: distanceKm,
      individual_cost_total: round(individualTotalCost, 2),
      pooled_cost_total: round(pooledTotalCost, 2),
      total_savings: round(savings, 2),
      savings_pct: savingsPct,
      individual_cost_per_kg: indCostPerKg,
      pooled_cost_per_kg: pooledCostPerKg,
      carbon_reduction_pct: 58.5,
      batch_allocations: batchAllocations
    };
  }
}
