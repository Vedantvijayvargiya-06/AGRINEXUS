from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Notification

router = APIRouter(prefix="/notifications", tags=["Notifications & Alerts"])

@router.get("")
def list_notifications(user_id: int = 1, db: Session = Depends(get_db)):
    notifs = db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc()).all()

    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "batch_id": n.batch_id,
            "title": n.title,
            "title_hi": n.title_hi,
            "message": n.message,
            "message_hi": n.message_hi,
            "type": n.type,
            "severity": n.severity,
            "is_read": n.is_read,
            "sent_sms": n.sent_sms,
            "created_at": n.created_at.isoformat()
        }
        for n in notifs
    ]

@router.put("/{notif_id}/read")
def mark_notification_read(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}

@router.put("/read-all")
def mark_all_notifications_read(user_id: int = 1, db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user_id).update({"is_read": True})
    db.commit()
    return {"status": "success"}
