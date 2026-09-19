from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Batch, Cluster, Recommendation
from app.services.reporting_service import ReportingService

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/summary")
def get_fpo_analytics_summary(db: Session = Depends(get_db)):
    batches = db.query(Batch).all()
    clusters = db.query(Cluster).all()

    batch_dicts = []
    for b in batches:
        rec = db.query(Recommendation).filter(Recommendation.batch_id == b.id).first()
        batch_dicts.append({
            "id": b.id,
            "batch_code": b.batch_code,
            "crop": b.crop,
            "quantity_kg": b.quantity_kg,
            "harvest_time": b.harvest_time.isoformat(),
            "location": b.location,
            "current_quality": b.current_quality,
            "shelf_life_hrs": b.shelf_life_hrs,
            "spoilage_risk": b.spoilage_risk,
            "status": b.status,
            "recommended_action": rec.recommended_action if rec else "sell_now",
            "best_expected_value": rec.best_expected_value if rec else (b.quantity_kg * 25.0)
        })

    cluster_dicts = [
        {
            "id": c.id,
            "cluster_code": c.cluster_code,
            "individual_cost_total": c.individual_transport_cost_per_kg * c.total_quantity_kg,
            "pooled_cost_total": c.pooled_transport_cost_per_kg * c.total_quantity_kg
        }
        for c in clusters
    ]

    summary = ReportingService.calculate_fpo_summary(batch_dicts, cluster_dicts)
    return summary

@router.get("/export/csv")
def export_batches_csv(db: Session = Depends(get_db)):
    batches = db.query(Batch).all()
    batch_dicts = []
    for b in batches:
        rec = db.query(Recommendation).filter(Recommendation.batch_id == b.id).first()
        batch_dicts.append({
            "batch_code": b.batch_code,
            "farmer_name": b.farmer.name if b.farmer else "Farmer",
            "crop": b.crop,
            "quantity_kg": b.quantity_kg,
            "harvest_time": b.harvest_time.strftime("%Y-%m-%d %H:%M"),
            "location": b.location,
            "current_quality": b.current_quality,
            "shelf_life_hrs": b.shelf_life_hrs,
            "spoilage_risk": b.spoilage_risk,
            "recommended_action": rec.recommended_action if rec else "sell_now",
            "best_expected_value": rec.best_expected_value if rec else 0,
            "status": b.status
        })

    csv_data = ReportingService.generate_csv_report(batch_dicts)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=agrinexus_post_harvest_report.csv"}
    )
