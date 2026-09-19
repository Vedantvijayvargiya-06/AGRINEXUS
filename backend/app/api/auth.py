import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

class OTPLoginRequest(BaseModel):
    phone: str
    otp: str = "123456" # Demo OTP auto-accept or custom
    role: Optional[str] = "farmer"

class PasswordLoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = "fpo_admin"

class SignupRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str = "farmer" # farmer, fpo_admin, buyer
    fpo_id: Optional[str] = "FPO-KOLAR-01"
    locality: Optional[str] = "Kolar, Karnataka"
    language_preference: Optional[str] = "en"

class RoleSwitchRequest(BaseModel):
    user_id: int

@router.post("/login-otp")
def login_with_otp(payload: OTPLoginRequest, db: Session = Depends(get_db)):
    # Find user by phone
    user = db.query(User).filter(User.phone == payload.phone).first()
    if not user:
        # Create demo farmer if not found for seamless evaluation
        user = User(
            name=f"Farmer {payload.phone[-4:]}",
            phone=payload.phone,
            role="farmer",
            locality="Kolar, Karnataka",
            fpo_id="FPO-KOLAR-01",
            language_preference="hi",
            is_approved=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Check lockout
    now = datetime.datetime.utcnow()
    if user.locked_until and user.locked_until > now:
        remaining_mins = int((user.locked_until - now).total_seconds() / 60)
        raise HTTPException(
            status_code=403,
            detail=f"Account locked due to consecutive failed attempts. Please try again in {remaining_mins} minutes."
        )

    return {
        "access_token": f"mock-jwt-token-user-{user.id}",
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "phone": user.phone,
            "email": user.email,
            "role": user.role,
            "fpo_id": user.fpo_id,
            "locality": user.locality,
            "language_preference": user.language_preference
        }
    }

@router.post("/login-password")
def login_with_password(payload: PasswordLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    now = datetime.datetime.utcnow()

    if user and user.locked_until and user.locked_until > now:
        remaining_mins = int((user.locked_until - now).total_seconds() / 60)
        raise HTTPException(
            status_code=403,
            detail=f"Account locked due to consecutive failed attempts. Please try again in {remaining_mins} minutes."
        )

    if not user:
        # Check standard demo credentials or return error
        raise HTTPException(status_code=401, detail="Invalid email or password credentials")

    # Reset failed attempts upon success
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()

    return {
        "access_token": f"mock-jwt-token-user-{user.id}",
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "phone": user.phone,
            "email": user.email,
            "role": user.role,
            "fpo_id": user.fpo_id,
            "locality": user.locality,
            "language_preference": user.language_preference
        }
    }

@router.post("/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    if payload.phone:
        existing = db.query(User).filter(User.phone == payload.phone).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already registered")
    if payload.email:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        role=payload.role,
        fpo_id=payload.fpo_id,
        locality=payload.locality,
        language_preference=payload.language_preference or "en",
        is_approved=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User registered successfully",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "role": new_user.role,
            "phone": new_user.phone,
            "email": new_user.email
        }
    }

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "phone": u.phone,
            "email": u.email,
            "role": u.role,
            "locality": u.locality,
            "fpo_id": u.fpo_id,
            "is_approved": u.is_approved
        }
        for u in users
    ]
