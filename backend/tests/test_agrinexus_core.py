import pytest
import datetime
from app.services.decay_engine import DecayEngine
from app.services.decision_engine import DecisionEngine
from app.services.cluster_optimizer import ClusterOptimizer
from app.services.agrinexus_assist import AgriNexusAssist

def test_decay_engine_q10_temperature_scaling():
    # At baseline 20°C, TF should be 1.0
    tf_20 = DecayEngine.compute_temperature_factor(20.0, q10=2.0)
    assert tf_20 == pytest.approx(1.0, 0.01)

    # At 30°C (10°C rise), decay rate doubles (TF = 2.0)
    tf_30 = DecayEngine.compute_temperature_factor(30.0, q10=2.0)
    assert tf_30 == pytest.approx(2.0, 0.01)

    # Effective shelf life of tomato (144 hrs base) at 30°C should be 72 hrs
    eff_life = DecayEngine.compute_effective_shelf_life(144.0, 30.0, q10=2.0)
    assert eff_life == pytest.approx(72.0, 0.1)

def test_quality_and_spoilage_calculation():
    # After 36 hours at 72 hrs effective life, quality should be ~50%
    quality = DecayEngine.compute_quality(hours_elapsed=36.0, effective_shelf_life=72.0, initial_quality=100.0)
    assert quality == pytest.approx(50.0, 0.1)

    spoilage = DecayEngine.compute_spoilage_risk(quality)
    assert spoilage == pytest.approx(50.0, 0.1)

    # Over 70% risk triggers alert
    risk_meta_crit = DecayEngine.get_risk_category(75.0)
    assert risk_meta_crit["alert_triggered"] is True
    assert risk_meta_crit["level"] == "high"

def test_decision_engine_computations():
    res = DecisionEngine.evaluate_batch_decision(
        crop="Tomato",
        quantity_kg=1000.0,
        current_quality=90.0,
        ambient_temp_c=25.0,
        hours_elapsed=12.0,
        local_mandi_price_per_kg=25.0,
        alternate_mandi_price_per_kg=42.0,
        storage_days=5,
        projected_price_increase_pct=20.0
    )

    assert "recommended_action" in res
    assert "best_expected_value" in res
    assert res["best_expected_value"] > 0
    assert "formula_breakdown" in res
    assert res["formula_breakdown"]["inputs"]["quantity_kg"] == 1000.0
    assert len(res["options_comparison"]) == 4

def test_cluster_pooling_optimization_savings():
    batches = [
        {"id": 1, "farmer_id": 101, "quantity_kg": 1200},
        {"id": 2, "farmer_id": 102, "quantity_kg": 1800},
        {"id": 3, "farmer_id": 103, "quantity_kg": 1500}
    ]
    res = ClusterOptimizer.evaluate_cluster_freight_savings(batches, distance_km=140.0)
    assert res["total_quantity_kg"] == 4500
    assert res["pooled_cost_per_kg"] < res["individual_cost_per_kg"]
    assert res["savings_pct"] > 40.0

def test_agrinexus_assist_grounding_and_guardrails():
    # Grounded query with batch context
    batch_ctx = {
        "crop": "Tomato",
        "crop_name_hi": "टमाटर",
        "current_quality": 88.0,
        "remaining_shelf_life_days": 3.5,
        "recommendation": {
            "recommended_action": "store",
            "recommended_title": "Cold Storage (7 Days)",
            "best_expected_value": 34500.0
        }
    }
    ans = AgriNexusAssist.answer_query("Why is storing recommended for my tomatoes?", user_lang="en", batch_context=batch_ctx)
    assert ans["grounded"] is True
    assert "₹34,500" in ans["answer"] or "Cold Storage" in ans["answer"]

    # Out of scope guardrail
    ans_guard = AgriNexusAssist.answer_query("Who won the cricket match?", user_lang="en")
    assert ans_guard["escalate_to_helpdesk"] is True
    assert ans_guard["uncertain"] is True
