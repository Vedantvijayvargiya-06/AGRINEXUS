from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Batch, Recommendation
from app.services.decision_engine import DecisionEngine
from app.services.decay_engine import DecayEngine
from app.services.market_service import MarketService

router = APIRouter(prefix="/decisions", tags=["Decision Recommendation & Simulator"])

class SimulateWhatIfRequest(BaseModel):
    crop: str = "Tomato"
    quantity_kg: float = 1200.0
    current_quality: float = 85.0
    ambient_temp_c: float = 28.0
    hours_elapsed: float = 24.0
    local_mandi_price_per_kg: float = 26.50
    alternate_mandi_price_per_kg: float = 42.00
    storage_days: int = 7
    projected_price_surge_pct: float = 15.0
    transport_delay_hours: float = 0.0
    is_pooled: bool = False
    cluster_pool_size_kg: float = 3000.0

@router.get("/batch/{batch_id}")
def get_batch_decision_breakdown(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    rec = db.query(Recommendation).filter(Recommendation.batch_id == batch.id).order_by(Recommendation.generated_at.desc()).first()
    if not rec:
        # Generate fresh calculation
        alt_mandi = MarketService.get_best_alternate_market(batch.crop)
        res = DecisionEngine.evaluate_batch_decision(
            crop=batch.crop,
            quantity_kg=batch.quantity_kg,
            current_quality=batch.current_quality,
            ambient_temp_c=batch.ambient_temp_c,
            hours_elapsed=batch.shelf_life_hrs,
            local_mandi_price_per_kg=26.50,
            alternate_mandi_price_per_kg=alt_mandi["modal_price_per_kg"]
        )
        return res

    return {
        "batch_id": batch.id,
        "batch_code": batch.batch_code,
        "crop": batch.crop,
        "recommended_action": rec.recommended_action,
        "best_expected_value": rec.best_expected_value,
        "net_values": {
            "sell_now": rec.net_value_sell,
            "store": rec.net_value_store,
            "process": rec.net_value_process,
            "redirect": rec.net_value_redirect
        },
        "formula_breakdown": rec.formula_breakdown,
        "explanation_en": rec.explanation_en,
        "explanation_hi": rec.explanation_hi,
        "confidence_score": rec.confidence_score,
        "generated_at": rec.generated_at.isoformat()
    }

@router.post("/simulate")
def simulate_what_if(payload: SimulateWhatIfRequest):
    """
    Real-time What-If simulator (SRS Section 3.8).
    Evaluates how changed transport delays, storage duration, price variations,
    and cluster pool sizes shift expected returns across all 4 pathways.
    """
    # Adjust quality for transport delay if any
    effective_temp = payload.ambient_temp_c
    adjusted_hours = payload.hours_elapsed + payload.transport_delay_hours
    
    # Evaluate decision live
    calc_res = DecisionEngine.evaluate_batch_decision(
        crop=payload.crop,
        quantity_kg=payload.quantity_kg,
        current_quality=payload.current_quality,
        ambient_temp_c=effective_temp,
        hours_elapsed=adjusted_hours,
        local_mandi_price_per_kg=payload.local_mandi_price_per_kg,
        alternate_mandi_price_per_kg=payload.alternate_mandi_price_per_kg,
        storage_days=payload.storage_days,
        projected_price_increase_pct=payload.projected_price_surge_pct,
        is_pooled=payload.is_pooled
    )

    return calc_res
