import datetime
import random
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Batch, User, Recommendation, Outcome, Notification
from app.services.decay_engine import DecayEngine
from app.services.decision_engine import DecisionEngine
from app.services.market_service import MarketService

router = APIRouter(prefix="/batches", tags=["Batches & Digital Twins"])

class AddBatchRequest(BaseModel):
    farmer_id: int = 1
    crop: str = "Tomato"
    variety: Optional[str] = "Standard Hybrid"
    quantity_kg: float = 1000.0
    harvest_time: Optional[datetime.datetime] = None
    location: Optional[str] = "Kolar Farm Gate"
    locality: Optional[str] = "Kolar"
    ambient_temp_c: float = 28.0
    storage_type: Optional[str] = "Ambient Farm Shed"
    photo_url: Optional[str] = None

class ConfirmOutcomeRequest(BaseModel):
    batch_id: int
    actual_action: str # sell_now, store, process, redirect
    actual_value_realised: float
    feedback_notes: Optional[str] = None

@router.get("")
def list_batches(
    farmer_id: Optional[int] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query("active"),
    db: Session = Depends(get_db)
):
    query = db.query(Batch)
    if farmer_id:
        query = query.filter(Batch.farmer_id == farmer_id)
    if status and status != "all":
        query = query.filter(Batch.status == status)

    batches = query.order_by(Batch.created_at.desc()).all()
    now = datetime.datetime.utcnow()

    results = []
    for b in batches:
        # Recompute live digital twin
        dt = DecayEngine.compute_batch_digital_twin(
            crop=b.crop,
            harvest_time=b.harvest_time,
            ambient_temp_c=b.ambient_temp_c,
            initial_quality=b.initial_quality,
            current_time=now
        )
        
        # Get latest recommendation
        rec = db.query(Recommendation).filter(Recommendation.batch_id == b.id).order_by(Recommendation.generated_at.desc()).first()

        results.append({
            "id": b.id,
            "batch_code": b.batch_code,
            "farmer_id": b.farmer_id,
            "farmer_name": b.farmer.name if b.farmer else "Farmer",
            "farmer_phone": b.farmer.phone if b.farmer else "",
            "crop": b.crop,
            "crop_name_hi": dt["crop_name_hi"],
            "variety": b.variety,
            "quantity_kg": b.quantity_kg,
            "harvest_time": b.harvest_time.isoformat(),
            "location": b.location,
            "locality": b.locality,
            "ambient_temp_c": b.ambient_temp_c,
            "storage_type": b.storage_type,
            "current_quality": dt["current_quality"],
            "shelf_life_hrs": dt["remaining_shelf_life_hrs"],
            "shelf_life_days": dt["remaining_shelf_life_days"],
            "spoilage_risk": dt["spoilage_risk"],
            "risk_level": dt["risk_level"],
            "risk_label": dt["risk_label"],
            "risk_label_hi": dt["risk_label_hi"],
            "risk_color": dt["risk_color"],
            "risk_bg_class": dt["risk_bg_class"],
            "alert_banner": dt["alert_banner"],
            "status": b.status,
            "cluster_id": b.cluster_id,
            "photo_url": b.photo_url,
            "recommendation": {
                "action": rec.recommended_action if rec else "sell_now",
                "expected_value": rec.best_expected_value if rec else 0.0,
                "net_values": {
                    "sell_now": rec.net_value_sell if rec else 0.0,
                    "store": rec.net_value_store if rec else 0.0,
                    "process": rec.net_value_process if rec else 0.0,
                    "redirect": rec.net_value_redirect if rec else 0.0
                } if rec else {},
                "explanation_en": rec.explanation_en if rec else "",
                "explanation_hi": rec.explanation_hi if rec else ""
            } if rec else None
        })

    return results

@router.get("/{batch_id}")
def get_batch_detail(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    now = datetime.datetime.utcnow()
    dt = DecayEngine.compute_batch_digital_twin(
        crop=batch.crop,
        harvest_time=batch.harvest_time,
        ambient_temp_c=batch.ambient_temp_c,
        initial_quality=batch.initial_quality,
        current_time=now
    )

    rec = db.query(Recommendation).filter(Recommendation.batch_id == batch.id).order_by(Recommendation.generated_at.desc()).first()

    return {
        "id": batch.id,
        "batch_code": batch.batch_code,
        "farmer_id": batch.farmer_id,
        "farmer_name": batch.farmer.name if batch.farmer else "Farmer",
        "crop": batch.crop,
        "crop_name_hi": dt["crop_name_hi"],
        "variety": batch.variety,
        "quantity_kg": batch.quantity_kg,
        "harvest_time": batch.harvest_time.isoformat(),
        "location": batch.location,
        "locality": batch.locality,
        "ambient_temp_c": batch.ambient_temp_c,
        "storage_type": batch.storage_type,
        "digital_twin": dt,
        "recommendation": {
            "action": rec.recommended_action if rec else "sell_now",
            "best_expected_value": rec.best_expected_value if rec else 0.0,
            "net_values": {
                "sell_now": rec.net_value_sell if rec else 0.0,
                "store": rec.net_value_store if rec else 0.0,
                "process": rec.net_value_process if rec else 0.0,
                "redirect": rec.net_value_redirect if rec else 0.0
            } if rec else {},
            "formula_breakdown": rec.formula_breakdown if rec else {},
            "explanation_en": rec.explanation_en if rec else "",
            "explanation_hi": rec.explanation_hi if rec else "",
            "confidence_score": rec.confidence_score if rec else 0.95
        } if rec else None
    }

@router.post("")
def add_batch(payload: AddBatchRequest, db: Session = Depends(get_db)):
    harvest_dt = payload.harvest_time or datetime.datetime.utcnow()
    now = datetime.datetime.utcnow()
    
    # Generate unique code
    code = f"BATCH-{payload.crop[:3].upper()}-{random.randint(100, 999)}"

    dt = DecayEngine.compute_batch_digital_twin(
        crop=payload.crop,
        harvest_time=harvest_dt,
        ambient_temp_c=payload.ambient_temp_c,
        initial_quality=98.0,
        current_time=now
    )

    new_batch = Batch(
        batch_code=code,
        farmer_id=payload.farmer_id,
        crop=payload.crop,
        variety=payload.variety or "Standard Hybrid",
        quantity_kg=payload.quantity_kg,
        harvest_time=harvest_dt,
        location=payload.location or "Farm Gate",
        locality=payload.locality or "Kolar",
        ambient_temp_c=payload.ambient_temp_c,
        storage_type=payload.storage_type or "Ambient Farm Shed",
        initial_quality=98.0,
        current_quality=dt["current_quality"],
        shelf_life_hrs=dt["remaining_shelf_life_hrs"],
        spoilage_risk=dt["spoilage_risk"],
        photo_url=payload.photo_url or "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400",
        status="active"
    )
    db.add(new_batch)
    db.flush()

    # Generate Decision Recommendation
    alt_mandi = MarketService.get_best_alternate_market(payload.crop)
    dec_calc = DecisionEngine.evaluate_batch_decision(
        crop=payload.crop,
        quantity_kg=payload.quantity_kg,
        current_quality=dt["current_quality"],
        ambient_temp_c=payload.ambient_temp_c,
        hours_elapsed=dt["hours_elapsed"],
        local_mandi_price_per_kg=26.50 if payload.crop == "Tomato" else 30.0,
        alternate_mandi_price_per_kg=alt_mandi["modal_price_per_kg"],
        distance_alternate_km=alt_mandi.get("distance_km", 140.0)
    )

    rec = Recommendation(
        batch_id=new_batch.id,
        recommended_action=dec_calc["recommended_action"],
        net_value_sell=dec_calc["net_values"]["sell_now"],
        net_value_store=dec_calc["net_values"]["store"],
        net_value_process=dec_calc["net_values"]["process"],
        net_value_redirect=dec_calc["net_values"]["redirect"],
        best_expected_value=dec_calc["best_expected_value"],
        formula_breakdown=dec_calc["formula_breakdown"],
        explanation_en=dec_calc["explanation_en"],
        explanation_hi=dec_calc["explanation_hi"],
        confidence_score=0.96
    )
    db.add(rec)

    # Check alert trigger
    if dt["spoilage_risk"] >= 70.0:
        notif = Notification(
            user_id=payload.farmer_id,
            batch_id=new_batch.id,
            title=f"CRITICAL SPOILAGE ALERT ({dt['spoilage_risk']:.0f}%) - {code}",
            title_hi=f"अत्यधिक सड़न जोखिम चेतावनी ({dt['spoilage_risk']:.0f}%): {code}",
            message=f"High ambient temperature is accelerating spoilage. Recommended immediate action: {dec_calc['recommended_title']}.",
            message_hi=f"तापमान के कारण फसल शीघ्र खराब हो सकती है। संस्तुत कार्यवाही: {dec_calc['recommended_title_hi']}.",
            type="spoilage_alert",
            severity="critical",
            sent_sms=True
        )
        db.add(notif)

    db.commit()
    db.refresh(new_batch)

    return {
        "message": "Batch registered successfully with Digital Twin generated",
        "batch_id": new_batch.id,
        "batch_code": new_batch.batch_code,
        "digital_twin": dt,
        "recommendation": dec_calc
    }

@router.post("/confirm-outcome")
def confirm_outcome(payload: ConfirmOutcomeRequest, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    rec = db.query(Recommendation).filter(Recommendation.batch_id == batch.id).order_by(Recommendation.generated_at.desc()).first()
    predicted_val = rec.best_expected_value if rec else payload.actual_value_realised
    error_pct = round(abs(payload.actual_value_realised - predicted_val) / max(1.0, predicted_val) * 100.0, 2)

    outcome = Outcome(
        batch_id=batch.id,
        actual_action=payload.actual_action,
        predicted_action=rec.recommended_action if rec else payload.actual_action,
        actual_value_realised=payload.actual_value_realised,
        predicted_value=predicted_val,
        error_pct=error_pct,
        feedback_notes=payload.feedback_notes
    )
    batch.status = "completed"
    db.add(outcome)
    db.commit()

    return {
        "message": "Outcome logged successfully to ML feedback training loop",
        "error_pct": error_pct,
        "actual_value_realised": payload.actual_value_realised
    }

@router.put("/{batch_id}/archive")
def archive_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    batch.status = "archived"
    db.commit()
    return {"message": f"Batch {batch.batch_code} archived"}
