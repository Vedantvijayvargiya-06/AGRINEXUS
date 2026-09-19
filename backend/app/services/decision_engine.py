import datetime
from typing import Dict, Any, Optional
from app.services.decay_engine import DecayEngine, DEFAULT_CROP_PROFILES

class DecisionEngine:
    """
    AgriNexus Decision & Optimization Engine (SRS Section 5.3.2).
    Evaluates 4 pathways: Sell Now, Store, Process, Redirect.
    Returns the optimal action with complete mathematical formula breakdowns.
    """

    @staticmethod
    def evaluate_batch_decision(
        crop: str,
        quantity_kg: float,
        current_quality: float,
        ambient_temp_c: float,
        hours_elapsed: float,
        local_mandi_price_per_kg: float,
        alternate_mandi_price_per_kg: float,
        distance_local_km: float = 35.0,
        distance_alternate_km: float = 140.0,
        storage_days: int = 7,
        projected_price_increase_pct: float = 15.0,
        is_pooled: bool = False,
        custom_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        params = custom_params or {}
        crop_profile = DEFAULT_CROP_PROFILES.get(crop, DEFAULT_CROP_PROFILES["Tomato"])

        # Base constants
        transport_rate_per_kg_km = params.get("transport_rate", crop_profile.get("transport_base_per_kg_km", 0.035))
        pooled_discount_factor = params.get("pooled_discount", 0.40) if is_pooled else 1.0 # 60% savings if pooled
        cold_storage_rate_day = params.get("storage_rate", crop_profile.get("cold_storage_rate_per_day_kg", 0.40))
        processing_value_rate = params.get("processing_rate", crop_profile.get("processing_rate_per_kg", 22.0))
        processing_cost_rate = params.get("processing_cost", crop_profile.get("processing_cost_per_kg", 3.5))

        quality_factor = max(0.1, current_quality / 100.0)

        # -------------------------------------------------------------
        # 1. SELL NOW
        # Sell now = quantity * fresh price * quality factor - transport cost
        # -------------------------------------------------------------
        solo_transport_local = quantity_kg * distance_local_km * transport_rate_per_kg_km
        transport_cost_sell = solo_transport_local * pooled_discount_factor
        gross_sell = quantity_kg * local_mandi_price_per_kg * quality_factor
        net_sell = round(gross_sell - transport_cost_sell, 2)

        # -------------------------------------------------------------
        # 2. STORE (Cold Storage)
        # Store = quantity * projected price * projected quality factor - storage cost - transport cost
        # In cold storage (e.g. 4-10°C), decay slows drastically
        # -------------------------------------------------------------
        storage_temp = crop_profile.get("optimal_temp_c", 10.0)
        storage_hours = storage_days * 24.0
        effective_life_cold = DecayEngine.compute_effective_shelf_life(
            crop_profile["base_shelf_life_hours"], storage_temp, crop_profile.get("q10_factor", 2.0)
        )
        projected_quality_after_storage = DecayEngine.compute_quality(
            hours_elapsed + (storage_hours * 0.3), # Cold chain reduces aging rate to 30%
            effective_life_cold,
            initial_quality=current_quality
        )
        projected_quality_factor = max(0.1, projected_quality_after_storage / 100.0)
        future_mandi_price = local_mandi_price_per_kg * (1.0 + (projected_price_increase_pct / 100.0))
        storage_cost = quantity_kg * cold_storage_rate_day * storage_days
        gross_store = quantity_kg * future_mandi_price * projected_quality_factor
        net_store = round(gross_store - storage_cost - transport_cost_sell, 2)

        # -------------------------------------------------------------
        # 3. PROCESS (Value Addition / Puree / Drying / Chips / Pulp)
        # Process = quantity * processing rate - processing cost
        # -------------------------------------------------------------
        # Processing yield value depends less on cosmetic fresh quality
        gross_process = quantity_kg * processing_value_rate
        processing_cost_total = quantity_kg * processing_cost_rate
        net_process = round(gross_process - processing_cost_total, 2)

        # -------------------------------------------------------------
        # 4. REDIRECT (High-demand distant Mandi / Terminal Market)
        # Redirect = quantity * alt_price * quality_factor - pooled transport cost - redirect handling fee
        # -------------------------------------------------------------
        solo_transport_alt = quantity_kg * distance_alternate_km * transport_rate_per_kg_km
        # Redirection assumes cluster pooling benefit for long haul
        transport_cost_redirect = solo_transport_alt * 0.45 
        redirect_handling_fee = quantity_kg * 0.50
        gross_redirect = quantity_kg * alternate_mandi_price_per_kg * quality_factor
        net_redirect = round(gross_redirect - transport_cost_redirect - redirect_handling_fee, 2)

        # Determine Winning Pathway
        options = [
            {
                "action": "sell_now",
                "action_title": "Sell Immediately (Local Mandi)",
                "action_title_hi": "स्थानीय मंडी में तुरंत बेचें",
                "net_value": net_sell,
                "gross_revenue": round(gross_sell, 2),
                "total_deductions": round(transport_cost_sell, 2),
                "risk_profile": "Zero Price Risk, Immediate Cash Liquidity",
                "risk_profile_hi": "शून्य मूल्य जोखिम, तत्काल नकद भुगतान",
                "formula_str": f"({quantity_kg} kg × ₹{local_mandi_price_per_kg}/kg × {quality_factor:.2f}) - ₹{transport_cost_sell:.2f} transport"
            },
            {
                "action": "store",
                "action_title": f"Cold Store ({storage_days} Days) for Price Upsurge",
                "action_title_hi": f"मूल्य वृद्धि के लिए कोल्ड स्टोरेज ({storage_days} दिन) में रखें",
                "net_value": net_store,
                "gross_revenue": round(gross_store, 2),
                "total_deductions": round(storage_cost + transport_cost_sell, 2),
                "risk_profile": f"Medium Risk; Projected +{projected_price_increase_pct}% Mandi Price Lift",
                "risk_profile_hi": f"मध्यम जोखिम; अनुमानित +{projected_price_increase_pct}% मंडी भाव उछाल",
                "formula_str": f"({quantity_kg} kg × ₹{future_mandi_price:.2f}/kg × {projected_quality_factor:.2f}) - ₹{storage_cost:.2f} storage - ₹{transport_cost_sell:.2f} transport"
            },
            {
                "action": "process",
                "action_title": "FPO / Local Secondary Processing",
                "action_title_hi": "एफपीओ / स्थानीय प्रसंस्करण इकाई को भेजें",
                "net_value": net_process,
                "gross_revenue": round(gross_process, 2),
                "total_deductions": round(processing_cost_total, 2),
                "risk_profile": "Guaranteed Floor Price, Immune to Cosmetic Decay",
                "risk_profile_hi": "न्यूनतम गारंटीकृत मूल्य, गुणवत्ता गिरावट से सुरक्षित",
                "formula_str": f"({quantity_kg} kg × ₹{processing_value_rate}/kg) - ₹{processing_cost_total:.2f} processing fee"
            },
            {
                "action": "redirect",
                "action_title": "Redirect to High-Demand Terminal Market",
                "action_title_hi": "उच्च मांग वाली बड़ी टर्मिनल मंडी में भेजें",
                "net_value": net_redirect,
                "gross_revenue": round(gross_redirect, 2),
                "total_deductions": round(transport_cost_redirect + redirect_handling_fee, 2),
                "risk_profile": "Higher Freight Distance; Premium Realization with Cluster Pooling",
                "risk_profile_hi": "अधिक दूरी; क्लस्टर पूलिंग के साथ प्रीमियम आय",
                "formula_str": f"({quantity_kg} kg × ₹{alternate_mandi_price_per_kg}/kg × {quality_factor:.2f}) - ₹{transport_cost_redirect:.2f} pooled freight - ₹{redirect_handling_fee:.2f} fee"
            }
        ]

        # Sort by expected net value descending
        ranked = sorted(options, key=lambda x: x["net_value"], reverse=True)
        winner = ranked[0]
        runner_up = ranked[1]
        profit_delta = round(winner["net_value"] - runner_up["net_value"], 2)

        # Generate Human-Friendly Explanations
        explanation_en = DecisionEngine._generate_explanation_en(
            winner["action"], winner["net_value"], profit_delta, runner_up["action"],
            crop, quantity_kg, current_quality, local_mandi_price_per_kg,
            alternate_mandi_price_per_kg, storage_days, projected_price_increase_pct
        )
        explanation_hi = DecisionEngine._generate_explanation_hi(
            winner["action"], winner["net_value"], profit_delta, runner_up["action"],
            crop, crop_profile["name_hi"], quantity_kg, current_quality, local_mandi_price_per_kg,
            alternate_mandi_price_per_kg, storage_days, projected_price_increase_pct
        )

        return {
            "recommended_action": winner["action"],
            "recommended_title": winner["action_title"],
            "recommended_title_hi": winner["action_title_hi"],
            "best_expected_value": winner["net_value"],
            "profit_delta_vs_runner_up": profit_delta,
            "runner_up_action": runner_up["action"],
            "net_values": {
                "sell_now": net_sell,
                "store": net_store,
                "process": net_process,
                "redirect": net_redirect
            },
            "options_comparison": options,
            "formula_breakdown": {
                "inputs": {
                    "crop": crop,
                    "quantity_kg": quantity_kg,
                    "current_quality_pct": current_quality,
                    "local_mandi_price": local_mandi_price_per_kg,
                    "alternate_mandi_price": alternate_mandi_price_per_kg,
                    "storage_days": storage_days,
                    "projected_price_surge_pct": projected_price_increase_pct,
                    "is_cluster_pooled": is_pooled
                },
                "calculations": {
                    "sell_now": {
                        "gross": round(gross_sell, 2),
                        "transport": round(transport_cost_sell, 2),
                        "net": net_sell
                    },
                    "store": {
                        "gross": round(gross_store, 2),
                        "storage_cost": round(storage_cost, 2),
                        "transport": round(transport_cost_sell, 2),
                        "projected_quality_pct": round(projected_quality_after_storage, 1),
                        "net": net_store
                    },
                    "process": {
                        "gross": round(gross_process, 2),
                        "processing_fee": round(processing_cost_total, 2),
                        "net": net_process
                    },
                    "redirect": {
                        "gross": round(gross_redirect, 2),
                        "freight_cost": round(transport_cost_redirect, 2),
                        "handling_fee": round(redirect_handling_fee, 2),
                        "net": net_redirect
                    }
                }
            },
            "explanation_en": explanation_en,
            "explanation_hi": explanation_hi,
            "confidence_score": 0.95
        }

    @staticmethod
    def _generate_explanation_en(
        action: str, best_val: float, delta: float, runner_up: str,
        crop: str, qty: float, quality: float, local_price: float,
        alt_price: float, storage_days: int, price_surge: float
    ) -> str:
        if action == "redirect":
            return (
                f"Recommendation: Redirect this {qty:,.0f} kg batch to the high-demand terminal market. "
                f"Expected net income is ₹{best_val:,.2f} (+₹{delta:,.2f} higher than {runner_up.replace('_', ' ')}). "
                f"The target market offers ₹{alt_price:.2f}/kg vs local rate of ₹{local_price:.2f}/kg, "
                f"comfortably outweighing pooled freight expenses while batch quality remains high ({quality:.0f}%)."
            )
        elif action == "store":
            return (
                f"Recommendation: Place this {qty:,.0f} kg batch into Cold Storage for {storage_days} days. "
                f"Expected net realization is ₹{best_val:,.2f} (+₹{delta:,.2f} over {runner_up.replace('_', ' ')}). "
                f"Market intelligence predicts a +{price_surge:.0f}% price surge, and controlled cold atmosphere "
                f"will preserve {qty:,.0f} kg produce with minimal decay."
            )
        elif action == "process":
            return (
                f"Recommendation: Divert this {qty:,.0f} kg batch to FPO / Local Food Processing. "
                f"Expected net return is ₹{best_val:,.2f} (+₹{delta:,.2f} over {runner_up.replace('_', ' ')}). "
                f"Given current quality ({quality:.0f}%) or local market softening, value-added processing eliminates spoilage risk and locks in guaranteed returns."
            )
        else: # sell_now
            return (
                f"Recommendation: Sell immediately in the local Mandi. "
                f"Expected net return is ₹{best_val:,.2f} (+₹{delta:,.2f} over {runner_up.replace('_', ' ')}). "
                f"Current fresh mandi price (₹{local_price:.2f}/kg) provides optimal immediate profit without cold storage holding charges or transit risk."
            )

    @staticmethod
    def _generate_explanation_hi(
        action: str, best_val: float, delta: float, runner_up: str,
        crop: str, crop_hi: str, qty: float, quality: float, local_price: float,
        alt_price: float, storage_days: int, price_surge: float
    ) -> str:
        if action == "redirect":
            return (
                f"सिफारिश: इस {qty:,.0f} किलो {crop_hi} को उच्च मांग वाली बड़ी टर्मिनल मंडी में भेजें। "
                f"अनुमानित शुद्ध आय ₹{best_val:,.2f} होगी (दूसरे विकल्प की तुलना में ₹{delta:,.2f} अधिक लाभ)। "
                f"टर्मिनल मंडी में ₹{alt_price:.2f}/किलो का प्रीमियम भाव मिल रहा है जो साझा ढुलाई खर्च के बाद भी सर्वाधिक लाभ देता है।"
            )
        elif action == "store":
            return (
                f"सिफारिश: इस {qty:,.0f} किलो {crop_hi} को {storage_days} दिनों के लिए कोल्ड स्टोरेज में रखें। "
                f"अनुमानित शुद्ध आय ₹{best_val:,.2f} होगी (+₹{delta:,.2f} अतिरिक्त लाभ)। "
                f"मंडी में +{price_surge:.0f}% मूल्य उछाल का पूर्वानुमान है और कोल्ड स्टोरेज में फसल सुरक्षित रहेगी।"
            )
        elif action == "process":
            return (
                f"सिफारिश: इस {qty:,.0f} किलो {crop_hi} को एफपीओ फूड प्रोसेसिंग यूनिट में भेजें। "
                f"अनुमानित शुद्ध आय ₹{best_val:,.2f} होगी (+₹{delta:,.2f} अतिरिक्त लाभ)। "
                f"गुणवत्ता ({quality:.0f}%) के अनुसार प्रसंस्करण करने से खराब होने का शून्य जोखिम रहता है और तय आय सुनिश्चित होती है।"
            )
        else:
            return (
                f"सिफारिश: स्थानीय मंडी में तुरंत बेचें। "
                f"अनुमानित शुद्ध आय ₹{best_val:,.2f} होगी (+₹{delta:,.2f} अतिरिक्त लाभ)। "
                f"वर्तमान भाव (₹{local_price:.2f}/किलो) पर तुरंत बेचने से बिना किसी स्टोरेज लागत के तुरंत नकद लाभ प्राप्त होगा।"
            )
