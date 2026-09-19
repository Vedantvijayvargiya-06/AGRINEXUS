import os
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models import Base, User, Batch, Cluster, MarketPrice, Recommendation, Outcome, Notification, CropConstant
from app.services.decay_engine import DEFAULT_CROP_PROFILES, DecayEngine
from app.services.decision_engine import DecisionEngine
from app.services.cluster_optimizer import ClusterOptimizer
from app.services.market_service import INITIAL_MANDI_FEED

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "agrinexus.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    seed_initial_data()

def seed_initial_data():
    db = SessionLocal()
    try:
        if db.query(User).first():
            return  # Already seeded

        print("[AgriNexus DB] Seeding initial users, crop constants, mandi prices, and batches...")

        # 1. Seed Crop Constants
        for crop_name, data in DEFAULT_CROP_PROFILES.items():
            crop_const = CropConstant(
                crop=crop_name,
                name_hi=data.get("name_hi", crop_name),
                base_shelf_life_hours=data["base_shelf_life_hours"],
                base_fresh_price_per_kg=data["base_fresh_price_per_kg"],
                processing_rate_per_kg=data["processing_rate_per_kg"],
                processing_cost_per_kg=data["processing_cost_per_kg"],
                cold_storage_rate_per_day_kg=data["cold_storage_rate_per_day_kg"],
                transport_base_per_kg_km=data["transport_base_per_kg_km"],
                q10_factor=data["q10_factor"],
                optimal_temp_c=data["optimal_temp_c"]
            )
            db.add(crop_const)

        # 2. Seed Users
        farmer1 = User(
            name="Ramesh Kumar",
            phone="9876543210",
            email="ramesh.farmer@agrinexus.org",
            role="farmer",
            fpo_id="FPO-KOLAR-01",
            locality="Kolar, Karnataka",
            language_preference="hi",
            is_approved=True
        )
        farmer2 = User(
            name="Suresh Patel",
            phone="9876543211",
            email="suresh.farmer@agrinexus.org",
            role="farmer",
            fpo_id="FPO-KOLAR-01",
            locality="Malur, Kolar",
            language_preference="en",
            is_approved=True
        )
        farmer3 = User(
            name="Anita Devi",
            phone="9876543212",
            email="anita.farmer@agrinexus.org",
            role="farmer",
            fpo_id="FPO-KOLAR-01",
            locality="Bangarapet, Kolar",
            language_preference="hi",
            is_approved=True
        )
        fpo_admin = User(
            name="Rajesh Sharma (FPO Admin)",
            phone="9876543299",
            email="admin@kisankalyan.org",
            role="fpo_admin",
            fpo_id="FPO-KOLAR-01",
            locality="Kolar Regional Office",
            language_preference="en",
            is_approved=True
        )
        buyer = User(
            name="AgroFresh Foods Procurement",
            phone="9876543300",
            email="procurement@agrofresh.in",
            role="buyer",
            fpo_id="BUYER-CORP-99",
            locality="Bengaluru Terminal Hub",
            language_preference="en",
            is_approved=True
        )
        sys_admin = User(
            name="System Administrator",
            phone="9876543399",
            email="superadmin@agrinexus.gov.in",
            role="admin",
            fpo_id="HQ-01",
            locality="National Operations",
            language_preference="en",
            is_approved=True
        )

        db.add_all([farmer1, farmer2, farmer3, fpo_admin, buyer, sys_admin])
        db.commit()

        # 3. Seed Market Prices
        for mp_data in INITIAL_MANDI_FEED:
            mp = MarketPrice(
                crop=mp_data["crop"],
                mandi=mp_data["mandi"],
                state=mp_data["state"],
                distance_km=mp_data["distance_km"],
                modal_price_per_kg=mp_data["modal_price_per_kg"],
                min_price_per_kg=mp_data["min_price_per_kg"],
                max_price_per_kg=mp_data["max_price_per_kg"],
                trend=mp_data["trend"],
                price_change_pct=mp_data["price_change_pct"],
                arrivals_tonnes=mp_data["arrivals_tonnes"],
                demand_index=mp_data["demand_index"]
            )
            db.add(mp)
        db.commit()

        # 4. Seed Batches & Digital Twins
        now = datetime.datetime.utcnow()

        batch_seeds = [
            {
                "code": "BATCH-TOM-101",
                "farmer": farmer1,
                "crop": "Tomato",
                "variety": "Arka Rakshak (Hybrid)",
                "quantity": 1200.0,
                "harvest_offset_hrs": 22.0,
                "temp": 28.0,
                "locality": "Kolar, Karnataka",
                "status": "active"
            },
            {
                "code": "BATCH-ONI-102",
                "farmer": farmer1,
                "crop": "Onion",
                "variety": "Bhima Dark Red",
                "quantity": 2500.0,
                "harvest_offset_hrs": 72.0,
                "temp": 26.0,
                "locality": "Kolar, Karnataka",
                "status": "active"
            },
            {
                "code": "BATCH-TOM-CRIT-103",
                "farmer": farmer1,
                "crop": "Tomato",
                "variety": "Local Standard",
                "quantity": 480.0,
                "harvest_offset_hrs": 68.0, # High temperature decay
                "temp": 34.0,
                "locality": "Kolar, Karnataka",
                "status": "active"
            },
            {
                "code": "BATCH-POT-104",
                "farmer": farmer2,
                "crop": "Potato",
                "variety": "Kufri Jyoti",
                "quantity": 1800.0,
                "harvest_offset_hrs": 40.0,
                "temp": 24.0,
                "locality": "Malur, Kolar",
                "status": "active"
            },
            {
                "code": "BATCH-TOM-105",
                "farmer": farmer3,
                "crop": "Tomato",
                "variety": "Arka Rakshak",
                "quantity": 1500.0,
                "harvest_offset_hrs": 18.0,
                "temp": 27.0,
                "locality": "Bangarapet, Kolar",
                "status": "active"
            }
        ]

        created_batches = []
        for b_spec in batch_seeds:
            harvest_dt = now - datetime.timedelta(hours=b_spec["harvest_offset_hrs"])
            dt_calc = DecayEngine.compute_batch_digital_twin(
                crop=b_spec["crop"],
                harvest_time=harvest_dt,
                ambient_temp_c=b_spec["temp"],
                initial_quality=98.0,
                current_time=now
            )

            b_obj = Batch(
                batch_code=b_spec["code"],
                farmer_id=b_spec["farmer"].id,
                crop=b_spec["crop"],
                variety=b_spec["variety"],
                quantity_kg=b_spec["quantity"],
                harvest_time=harvest_dt,
                location=f"{b_spec['locality']} Farm Cluster",
                locality=b_spec["locality"],
                ambient_temp_c=b_spec["temp"],
                initial_quality=98.0,
                current_quality=dt_calc["current_quality"],
                shelf_life_hrs=dt_calc["remaining_shelf_life_hrs"],
                spoilage_risk=dt_calc["spoilage_risk"],
                status=b_spec["status"]
            )
            db.add(b_obj)
            db.flush()

            # Compute Decision Recommendation
            dec_calc = DecisionEngine.evaluate_batch_decision(
                crop=b_spec["crop"],
                quantity_kg=b_spec["quantity"],
                current_quality=dt_calc["current_quality"],
                ambient_temp_c=b_spec["temp"],
                hours_elapsed=b_spec["harvest_offset_hrs"],
                local_mandi_price_per_kg=26.50 if b_spec["crop"] == "Tomato" else (34.0 if b_spec["crop"] == "Onion" else 22.0),
                alternate_mandi_price_per_kg=42.00 if b_spec["crop"] == "Tomato" else (38.0 if b_spec["crop"] == "Onion" else 25.0)
            )

            rec_obj = Recommendation(
                batch_id=b_obj.id,
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
            db.add(rec_obj)

            # Check for critical spoilage alert (FR-2.4 & FR-11.1)
            if dt_calc["spoilage_risk"] >= 70.0:
                notif = Notification(
                    user_id=b_spec["farmer"].id,
                    batch_id=b_obj.id,
                    title=f"CRITICAL SPOILAGE RISK ({dt_calc['spoilage_risk']:.0f}%) on {b_obj.batch_code}",
                    title_hi=f"अत्यधिक सड़न जोखिम चेतावनी ({dt_calc['spoilage_risk']:.0f}%): {b_obj.batch_code}",
                    message=f"Produce ambient temperature ({b_spec['temp']}°C) has accelerated decay. Divert to Processing unit immediately to save ₹{dec_calc['net_values']['process']:,.2f}.",
                    message_hi=f"अधिक तापमान ({b_spec['temp']}°C) के कारण फसल तेजी से खराब हो रही है। तुरंत प्रोसेसिंग में भेजकर ₹{dec_calc['net_values']['process']:,.2f} की आय सुरक्षित करें।",
                    type="spoilage_alert",
                    severity="critical",
                    sent_sms=True
                )
                db.add(notif)

            created_batches.append(b_obj)

        db.commit()

        # 5. Seed Candidate Cluster Pooling
        tomato_batches = [b for b in created_batches if b.crop == "Tomato" and b.spoilage_risk < 70.0]
        if tomato_batches:
            batch_dicts = [
                {
                    "id": b.id,
                    "batch_code": b.batch_code,
                    "farmer_id": b.farmer_id,
                    "farmer_name": "Ramesh / Suresh",
                    "quantity_kg": b.quantity_kg
                }
                for b in tomato_batches
            ]
            eval_res = ClusterOptimizer.evaluate_cluster_freight_savings(batch_dicts, distance_km=140.0)

            cluster1 = Cluster(
                cluster_code="CLUS-KOLAR-TOM-01",
                crop="Tomato",
                locality="Kolar District Hub",
                destination_mandi="Azadpur Mandi, Delhi",
                total_quantity_kg=eval_res["total_quantity_kg"],
                individual_transport_cost_per_kg=eval_res["individual_cost_per_kg"],
                pooled_transport_cost_per_kg=eval_res["pooled_cost_per_kg"],
                cost_savings_pct=eval_res["savings_pct"],
                vehicle_type=eval_res["vehicle_type"],
                capacity_utilization_pct=eval_res["capacity_utilization_pct"],
                status="candidate"
            )
            db.add(cluster1)
            db.flush()

            for b in tomato_batches:
                b.cluster_id = cluster1.id

            db.commit()

        print("[AgriNexus DB] Initialization and pre-seeding completed successfully.")

    except Exception as e:
        db.rollback()
        print(f"[AgriNexus DB Error] Failed during seeding: {e}")
    finally:
        db.close()
