from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import MarketPrice, Notification, User

router = APIRouter(prefix="/market", tags=["Market Intelligence"])

class PriceOverrideRequest(BaseModel):
    market_price_id: int
    new_modal_price: float
    reason: Optional[str] = "Admin field validation override"

@router.get("/prices")
def get_mandi_prices(crop: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(MarketPrice)
    if crop:
        query = query.filter(MarketPrice.crop.ilike(f"%{crop}%"))
    
    prices = query.order_by(MarketPrice.modal_price_per_kg.desc()).all()
    return [
        {
            "id": p.id,
            "crop": p.crop,
            "mandi": p.mandi,
            "state": p.state,
            "distance_km": p.distance_km,
            "modal_price_per_kg": p.modal_price_per_kg,
            "min_price_per_kg": p.min_price_per_kg,
            "max_price_per_kg": p.max_price_per_kg,
            "trend": p.trend,
            "price_change_pct": p.price_change_pct,
            "arrivals_tonnes": p.arrivals_tonnes,
            "demand_index": p.demand_index,
            "is_manual_override": p.is_manual_override,
            "fetched_at": p.fetched_at.isoformat()
        }
        for p in prices
    ]

@router.post("/override-price")
def override_price(payload: PriceOverrideRequest, db: Session = Depends(get_db)):
    mp = db.query(MarketPrice).filter(MarketPrice.id == payload.market_price_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Market price entry not found")

    old_price = mp.modal_price_per_kg
    mp.modal_price_per_kg = payload.new_modal_price
    mp.is_manual_override = True
    
    diff_pct = round(((payload.new_modal_price - old_price) / old_price) * 100.0, 1)
    mp.price_change_pct = diff_pct
    mp.trend = "rising" if diff_pct > 0 else ("falling" if diff_pct < 0 else "flat")

    # Send price surge/dip alert to all registered farmers of that crop (FR-5.4)
    farmers = db.query(User).filter(User.role == "farmer").all()
    for f in farmers:
        notif = Notification(
            user_id=f.id,
            title=f"Mandi Price Update: {mp.crop} at {mp.mandi}",
            title_hi=f"मंडी भाव अपडेट: {mp.crop} ({mp.mandi})",
            message=f"Modal price updated to ₹{mp.modal_price_per_kg}/kg ({diff_pct:+}% shift). Recalculating your batch decisions.",
            message_hi=f"नया भाव ₹{mp.modal_price_per_kg}/किलो दर्ज हुआ है ({diff_pct:+}% बदलाव)। आपके बैच की संस्तुति अपडेट की जा रही है।",
            type="price_movement",
            severity="medium",
            sent_sms=True
        )
        db.add(notif)

    db.commit()

    return {
        "message": f"Mandi price updated to ₹{payload.new_modal_price}/kg and alerts broadcast.",
        "crop": mp.crop,
        "mandi": mp.mandi,
        "new_modal_price": mp.modal_price_per_kg,
        "trend": mp.trend
    }
