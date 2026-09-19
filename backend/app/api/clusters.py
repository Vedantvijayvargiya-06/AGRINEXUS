import datetime
import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Cluster, Batch, User, Notification
from app.services.cluster_optimizer import ClusterOptimizer

router = APIRouter(prefix="/clusters", tags=["Cluster Pooling"])

class ConfirmClusterRequest(BaseModel):
    cluster_id: int
    admin_id: int = 4
    destination_mandi: Optional[str] = "Azadpur Mandi, Delhi"

@router.get("")
def list_clusters(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Cluster)
    if status and status != "all":
        query = query.filter(Cluster.status == status)

    clusters = query.order_by(Cluster.created_at.desc()).all()
    results = []

    for c in clusters:
        batches_in_cluster = db.query(Batch).filter(Batch.cluster_id == c.id).all()
        batch_list = [
            {
                "id": b.id,
                "batch_code": b.batch_code,
                "farmer_name": b.farmer.name if b.farmer else "Farmer",
                "farmer_phone": b.farmer.phone if b.farmer else "",
                "quantity_kg": b.quantity_kg,
                "quality": b.current_quality,
                "spoilage_risk": b.spoilage_risk
            }
            for b in batches_in_cluster
        ]

        results.append({
            "id": c.id,
            "cluster_code": c.cluster_code,
            "crop": c.crop,
            "locality": c.locality,
            "destination_mandi": c.destination_mandi,
            "total_quantity_kg": c.total_quantity_kg,
            "individual_transport_cost_per_kg": c.individual_transport_cost_per_kg,
            "pooled_transport_cost_per_kg": c.pooled_transport_cost_per_kg,
            "cost_savings_pct": c.cost_savings_pct,
            "vehicle_type": c.vehicle_type,
            "capacity_utilization_pct": c.capacity_utilization_pct,
            "status": c.status,
            "created_at": c.created_at.isoformat(),
            "batches_count": len(batch_list),
            "batches": batch_list
        })

    return results

@router.post("/optimize-candidates")
def generate_candidate_clusters(crop: str = "Tomato", locality: str = "Kolar", db: Session = Depends(get_db)):
    """
    Groups active, unpooled batches into candidate clusters (FR-6.1 & FR-6.2).
    """
    active_batches = db.query(Batch).filter(
        Batch.crop == crop,
        Batch.status == "active",
        Batch.spoilage_risk < 70.0
    ).all()

    if not active_batches:
        return {"message": "No unpooled batches available for candidate clustering", "candidates": []}

    batch_dicts = [
        {
            "id": b.id,
            "batch_code": b.batch_code,
            "farmer_id": b.farmer_id,
            "farmer_name": b.farmer.name if b.farmer else "Farmer",
            "quantity_kg": b.quantity_kg
        }
        for b in active_batches
    ]

    opt_result = ClusterOptimizer.evaluate_cluster_freight_savings(batch_dicts, distance_km=140.0)

    # Create new candidate cluster record if needed
    code = f"CLUS-{crop[:3].upper()}-{locality[:3].upper()}-{random.randint(100, 999)}"
    new_cluster = Cluster(
        cluster_code=code,
        crop=crop,
        locality=f"{locality} Cluster Area",
        destination_mandi="Azadpur Mandi, Delhi",
        total_quantity_kg=opt_result["total_quantity_kg"],
        individual_transport_cost_per_kg=opt_result["individual_cost_per_kg"],
        pooled_transport_cost_per_kg=opt_result["pooled_cost_per_kg"],
        cost_savings_pct=opt_result["savings_pct"],
        vehicle_type=opt_result["vehicle_type"],
        capacity_utilization_pct=opt_result["capacity_utilization_pct"],
        status="candidate"
    )
    db.add(new_cluster)
    db.flush()

    for b in active_batches:
        b.cluster_id = new_cluster.id

    db.commit()

    return {
        "cluster_id": new_cluster.id,
        "cluster_code": new_cluster.cluster_code,
        "optimization": opt_result
    }

@router.post("/confirm")
def confirm_cluster(payload: ConfirmClusterRequest, db: Session = Depends(get_db)):
    cluster = db.query(Cluster).filter(Cluster.id == payload.cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    cluster.status = "confirmed"
    cluster.confirmed_by_id = payload.admin_id
    cluster.dispatch_date = datetime.datetime.utcnow() + datetime.timedelta(hours=14)
    if payload.destination_mandi:
        cluster.destination_mandi = payload.destination_mandi

    # Notify all participating farmers via simulated SMS & in-app alerts (FR-6.3 & FR-11.2)
    batches = db.query(Batch).filter(Batch.cluster_id == cluster.id).all()
    notified_farmers = []

    for b in batches:
        if b.farmer_id:
            notif = Notification(
                user_id=b.farmer_id,
                batch_id=b.id,
                title=f"Pooling Cluster Confirmed: {cluster.cluster_code}",
                title_hi=f"क्लस्टर पूलिंग स्वीकृत: {cluster.cluster_code}",
                message=(
                    f"Your batch {b.batch_code} ({b.quantity_kg}kg) is confirmed for shared transport to {cluster.destination_mandi}. "
                    f"Transport rate: ₹{cluster.pooled_transport_cost_per_kg}/kg (Saved {cluster.cost_savings_pct}%!). Dispatch: Tomorrow 6:00 AM."
                ),
                message_hi=(
                    f"आपका {b.crop} बैच ({b.quantity_kg} किलो) {cluster.destination_mandi} के लिए संयुक्त वाहन में शामिल कर लिया गया है। "
                    f"भाड़ा दर: मात्र ₹{cluster.pooled_transport_cost_per_kg}/किलो (बचत {cluster.cost_savings_pct}%)! रवानगी: कल सुबह 6:00 बजे।"
                ),
                type="cluster_invite",
                severity="medium",
                sent_sms=True
            )
            db.add(notif)
            notified_farmers.append(b.farmer_id)

    db.commit()

    return {
        "message": f"Cluster {cluster.cluster_code} confirmed successfully. SMS dispatched to {len(set(notified_farmers))} member farmers.",
        "cluster_code": cluster.cluster_code,
        "status": cluster.status,
        "dispatch_date": cluster.dispatch_date.isoformat(),
        "total_kg": cluster.total_quantity_kg
    }
