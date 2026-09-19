import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    email = Column(String(100), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(50), default="farmer")  # farmer, fpo_admin, buyer, admin
    fpo_id = Column(String(50), nullable=True)
    locality = Column(String(100), default="Kolar, Karnataka")
    language_preference = Column(String(10), default="en")  # en, hi
    is_approved = Column(Boolean, default=True)
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    batches = relationship("Batch", back_populates="farmer")

class CropConstant(Base):
    __tablename__ = "crop_constants"

    crop = Column(String(50), primary_key=True)
    name_hi = Column(String(50), default="")
    base_shelf_life_hours = Column(Float, default=120.0)  # e.g., 5 days = 120 hrs at 20°C
    base_fresh_price_per_kg = Column(Float, default=25.0)
    processing_rate_per_kg = Column(Float, default=18.0)  # Pulp / Paste / Dehydrated rate
    processing_cost_per_kg = Column(Float, default=4.0)
    cold_storage_rate_per_day_kg = Column(Float, default=0.5)
    transport_base_per_kg_km = Column(Float, default=0.04) # ₹ per kg per 100km
    q10_factor = Column(Float, default=2.0)
    optimal_temp_c = Column(Float, default=12.0)

class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String(50), unique=True, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id"))
    crop = Column(String(50), nullable=False)
    variety = Column(String(50), default="Standard")
    quantity_kg = Column(Float, nullable=False)
    harvest_time = Column(DateTime, default=datetime.datetime.utcnow)
    location = Column(String(100), default="Kolar Mandi Zone")
    locality = Column(String(100), default="Kolar")
    ambient_temp_c = Column(Float, default=28.0)
    storage_type = Column(String(50), default="Ambient Farm Shed")
    initial_quality = Column(Float, default=98.0)
    current_quality = Column(Float, default=95.0)
    shelf_life_hrs = Column(Float, default=80.0)
    spoilage_risk = Column(Float, default=5.0)
    photo_url = Column(String(255), nullable=True)
    status = Column(String(50), default="active") # active, pooled, sold, stored, processed, redirected, archived
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    farmer = relationship("User", back_populates="batches")
    cluster = relationship("Cluster", back_populates="batches")
    recommendations = relationship("Recommendation", back_populates="batch")
    outcome = relationship("Outcome", back_populates="batch", uselist=False)

class Cluster(Base):
    __tablename__ = "clusters"

    id = Column(Integer, primary_key=True, index=True)
    cluster_code = Column(String(50), unique=True, index=True)
    crop = Column(String(50), nullable=False)
    locality = Column(String(100), nullable=False)
    destination_mandi = Column(String(100), default="Azadpur Mandi, Delhi")
    total_quantity_kg = Column(Float, default=0.0)
    individual_transport_cost_per_kg = Column(Float, default=4.5)
    pooled_transport_cost_per_kg = Column(Float, default=1.8)
    cost_savings_pct = Column(Float, default=60.0)
    vehicle_type = Column(String(50), default="10-Ton Refrigerated Truck")
    capacity_utilization_pct = Column(Float, default=85.0)
    status = Column(String(50), default="candidate") # candidate, confirmed, dispatched, completed
    confirmed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dispatch_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    batches = relationship("Batch", back_populates="cluster")

class MarketPrice(Base):
    __tablename__ = "market_prices"

    id = Column(Integer, primary_key=True, index=True)
    crop = Column(String(50), nullable=False)
    mandi = Column(String(100), nullable=False)
    state = Column(String(100), default="Karnataka")
    distance_km = Column(Float, default=45.0)
    modal_price_per_kg = Column(Float, nullable=False)
    min_price_per_kg = Column(Float, nullable=False)
    max_price_per_kg = Column(Float, nullable=False)
    trend = Column(String(20), default="rising") # rising, falling, flat
    price_change_pct = Column(Float, default=4.2)
    arrivals_tonnes = Column(Float, default=120.0)
    demand_index = Column(String(20), default="High") # High, Moderate, Low
    is_manual_override = Column(Boolean, default=False)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    recommended_action = Column(String(50), nullable=False) # sell_now, store, process, redirect
    net_value_sell = Column(Float, default=0.0)
    net_value_store = Column(Float, default=0.0)
    net_value_process = Column(Float, default=0.0)
    net_value_redirect = Column(Float, default=0.0)
    best_expected_value = Column(Float, default=0.0)
    formula_breakdown = Column(JSON, nullable=True)
    explanation_en = Column(Text, nullable=True)
    explanation_hi = Column(Text, nullable=True)
    confidence_score = Column(Float, default=0.94)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)

    batch = relationship("Batch", back_populates="recommendations")

class Outcome(Base):
    __tablename__ = "outcomes"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), unique=True)
    actual_action = Column(String(50), nullable=False) # sell_now, store, process, redirect
    predicted_action = Column(String(50), nullable=False)
    actual_value_realised = Column(Float, nullable=False)
    predicted_value = Column(Float, nullable=False)
    error_pct = Column(Float, default=0.0)
    feedback_notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

    batch = relationship("Batch", back_populates="outcome")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    title = Column(String(200), nullable=False)
    title_hi = Column(String(200), nullable=True)
    message = Column(Text, nullable=False)
    message_hi = Column(Text, nullable=True)
    type = Column(String(50), default="alert") # spoilage_alert, price_movement, cluster_invite, system
    severity = Column(String(20), default="medium") # low, medium, high, critical
    is_read = Column(Boolean, default=False)
    sent_sms = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    messages = Column(JSON, default=list)
    language = Column(String(10), default="en")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
