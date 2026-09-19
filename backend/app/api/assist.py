from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Batch, MarketPrice, User, Recommendation
from app.services.agrinexus_assist import AgriNexusAssist
from app.services.decay_engine import DecayEngine

router = APIRouter(prefix="/assist", tags=["AgriNexus Assist (Conversational AI)"])

class ChatQueryRequest(BaseModel):
    query: str
    user_id: Optional[int] = 1
    batch_id: Optional[int] = None
    language: Optional[str] = "en" # "en" or "hi"

class HelpdeskTicketRequest(BaseModel):
    user_id: int
    batch_id: Optional[int] = None
    issue_topic: str
    query_text: str
    contact_phone: Optional[str] = None

@router.post("/chat")
def ask_assistant(payload: ChatQueryRequest, db: Session = Depends(get_db)):
    """
    RAG-grounded Conversational Q&A across live batch telemetry, mandi feeds, and ICAR guidelines.
    """
    batch_ctx = None
    if payload.batch_id:
        batch = db.query(Batch).filter(Batch.id == payload.batch_id).first()
        if batch:
            dt = DecayEngine.compute_batch_digital_twin(
                crop=batch.crop,
                harvest_time=batch.harvest_time,
                ambient_temp_c=batch.ambient_temp_c,
                initial_quality=batch.initial_quality
            )
            rec = db.query(Recommendation).filter(Recommendation.batch_id == batch.id).order_by(Recommendation.generated_at.desc()).first()
            
            batch_ctx = {
                "id": batch.id,
                "batch_code": batch.batch_code,
                "crop": batch.crop,
                "crop_name_hi": dt["crop_name_hi"],
                "quantity_kg": batch.quantity_kg,
                "current_quality": dt["current_quality"],
                "spoilage_risk": dt["spoilage_risk"],
                "remaining_shelf_life_hrs": dt["remaining_shelf_life_hrs"],
                "remaining_shelf_life_days": dt["remaining_shelf_life_days"],
                "recommendation": {
                    "recommended_action": rec.recommended_action if rec else "sell_now",
                    "recommended_title": "Redirect to Terminal Market" if rec and rec.recommended_action == "redirect" else ("Store in Cold Storage" if rec and rec.recommended_action == "store" else "Sell in Local Mandi"),
                    "recommended_title_hi": "टर्मिनल मंडी में भेजें" if rec and rec.recommended_action == "redirect" else ("कोल्ड स्टोरेज में रखें" if rec and rec.recommended_action == "store" else "स्थानीय मंडी में बेचें"),
                    "best_expected_value": rec.best_expected_value if rec else 0.0,
                    "explanation_en": rec.explanation_en if rec else "",
                    "explanation_hi": rec.explanation_hi if rec else ""
                }
            }

    # Fetch live mandi market context
    market_items = db.query(MarketPrice).limit(5).all()
    market_ctx = [
        {
            "crop": mp.crop,
            "mandi": mp.mandi,
            "modal_price_per_kg": mp.modal_price_per_kg,
            "trend": mp.trend,
            "arrivals_tonnes": mp.arrivals_tonnes
        }
        for mp in market_items
    ]

    response = AgriNexusAssist.answer_query(
        query=payload.query,
        user_lang=payload.language or "en",
        batch_context=batch_ctx,
        market_context=market_ctx
    )

    return response

@router.post("/escalate-helpdesk")
def escalate_to_fpo_helpdesk(payload: HelpdeskTicketRequest, db: Session = Depends(get_db)):
    """
    Escalates an unanswerable or complex agronomy/dispute question to the FPO Helpdesk (FR-9.6).
    """
    user = db.query(User).filter(User.id == payload.user_id).first()
    ticket_id = f"TICKET-FPO-{user.id if user else 1}-{int(datetime.datetime.utcnow().timestamp()) % 10000}"
    
    return {
        "status": "success",
        "ticket_id": ticket_id,
        "message": "Your query has been assigned to an FPO Agronomist / Market Specialist. They will call you at your registered mobile number shortly.",
        "message_hi": "आपका प्रश्न एफपीओ कृषि विशेषज्ञ को भेज दिया गया है। वे शीघ्र ही आपके पंजीकृत मोबाइल नंबर पर संपर्क करेंगे।",
        "fpo_helpdesk_number": "+91 80 2345 6789 (Toll-Free Kisan Helpdesk)"
    }
