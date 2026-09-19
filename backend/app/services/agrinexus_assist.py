import datetime
from typing import Dict, Any, List, Optional

POST_HARVEST_KNOWLEDGE_BASE = [
    {
        "topic": "Tomato Storage & Ripening",
        "keywords": ["tomato", "ripening", "cold storage", "chilling injury", "टमाटर"],
        "content_en": "Tomatoes should not be stored below 10°C as chilling injury causes loss of flavor and softening. Optimal holding temperature is 12°C-15°C with 85-90% relative humidity.",
        "content_hi": "टमाटर को 10°C से नीचे स्टोर नहीं करना चाहिए क्योंकि इससे चिलिंग इंजरी (स्वाद खराब और सड़न) हो सकती है। इष्टतम तापमान 12°C-15°C और 85-90% आर्द्रता है।"
    },
    {
        "topic": "Onion Curing & Ventilation",
        "keywords": ["onion", "sprouting", "curing", "ventilation", "storage", "प्याज"],
        "content_en": "Onions require thorough field curing (drying the neck) for 5-7 days before storage. Store in well-ventilated sheds at 25-30°C with low humidity (<65%) to prevent black mold and premature sprouting.",
        "content_hi": "प्याज को भंडारण से पहले 5-7 दिनों तक अच्छी तरह सुखाना (क्योरिंग) आवश्यक है। इसे हवादार गोदाम में 25-30°C पर कम नमी (<65%) में रखें ताकि फफूंद और अंकुरण न हो।"
    },
    {
        "topic": "Cluster Pooling Transport",
        "keywords": ["cluster", "pooling", "truck", "transport", "freight", "share", "पूलिंग", "किराया", "गाड़ी"],
        "content_en": "Cluster pooling combines harvests from neighboring farmers in a 15km radius into a single large refrigerated truck, reducing per-kg transport freight by up to 60%.",
        "content_hi": "क्लस्टर पूलिंग 15 किमी के दायरे में आसपास के किसानों की उपज को एक साथ बड़े वाहन में भेजती है, जिससे प्रति किलो परिवहन भाड़ा 60% तक कम हो जाता है।"
    },
    {
        "topic": "Post-Harvest Processing Opportunities",
        "keywords": ["process", "processing", "puree", "pulp", "dehydration", "chips", "प्रसंस्करण"],
        "content_en": "When fresh market prices fall below production costs, diverting produce to processing (puree for tomato, dehydration for onion, chips for potato) locks in a guaranteed minimum floor price.",
        "content_hi": "जब ताजी मंडी में भाव गिरते हैं, तो उपज को प्रसंस्करण (टमाटर प्यूरी, प्याज निर्जलीकरण, आलू चिप्स) में भेजने से न्यूनतम सुरक्षित आय प्राप्त होती है।"
    }
]

class AgriNexusAssist:
    """
    AgriNexus Assist Conversational AI Layer (SRS Section 3.9 & 5.3.3).
    Provides RAG-grounded contextual assistance across farmer batches, market trends, and post-harvest intelligence.
    """

    @staticmethod
    def answer_query(
        query: str,
        user_lang: str = "en",
        batch_context: Optional[Dict[str, Any]] = None,
        market_context: Optional[List[Dict[str, Any]]] = None,
        fpo_name: str = "Kisan Kalyan FPO"
    ) -> Dict[str, Any]:
        q_lower = query.lower().strip()
        is_hindi = user_lang.startswith("hi") or any(char in query for char in ["क्या", "कैसे", "टमाटर", "प्याज", "बेचें", "रखें", "भाव", "मंडी", "कितना"])

        # Check for out-of-scope topics (e.g. politics, medical, cricket)
        out_of_scope_triggers = ["cricket", "ipl", "election", "movie", "cinema", "illness", "doctor", "medicine", "crypto", "bitcoin"]
        if any(w in q_lower for w in out_of_scope_triggers):
            if is_hindi:
                return {
                    "answer": "मुझे केवल कृषि उपज, मंडी भाव, भंडारण, क्लस्टर पूलिंग और फसल गुणवत्ता के प्रश्नों का उत्तर देने के लिए प्रशिक्षित किया गया है। अन्य सहायता के लिए कृपया एफपीओ हेल्पडेस्क से संपर्क करें।",
                    "language": "hi",
                    "grounded": False,
                    "uncertain": True,
                    "escalate_to_helpdesk": True,
                    "source": "guardrail"
                }
            else:
                return {
                    "answer": "I am specialized solely in post-harvest decisions, market intelligence, crop shelf-life, and cluster pooling. For this topic, please contact the FPO Helpdesk.",
                    "language": "en",
                    "grounded": False,
                    "uncertain": True,
                    "escalate_to_helpdesk": True,
                    "source": "guardrail"
                }

        # 1. Grounded Batch Context Questions (e.g., "Why should I store?", "What is my shelf life?", "क्या मुझे बेचना चाहिए?")
        if batch_context:
            crop = batch_context.get("crop", "Produce")
            crop_hi = batch_context.get("crop_name_hi", crop)
            quality = batch_context.get("current_quality", 90.0)
            shelf_hrs = batch_context.get("remaining_shelf_life_hrs", 72.0)
            shelf_days = batch_context.get("remaining_shelf_life_days", 3.0)
            risk = batch_context.get("spoilage_risk", 10.0)
            rec = batch_context.get("recommendation", {})
            action = rec.get("recommended_action", "sell_now")
            best_val = rec.get("best_expected_value", 0.0)

            # Match questions asking about current recommendation
            if any(w in q_lower for w in ["recommend", "action", "why", "decision", "what to do", "store", "sell", "process", "redirect", "सलाह", "सुझाव", "क्यों", "क्या करूं", "बेचूं", "रखूं"]):
                if is_hindi:
                    ans = (
                        f"आपके {crop_hi} बैच (गुणवत्ता {quality:.0f}%, शेष जीवन {shelf_days} दिन) के लिए "
                        f"हमारी प्रणाली **{rec.get('recommended_title_hi', 'उत्तम विकल्प')}** की सलाह देती है। "
                        f"इससे आपको लगभग **₹{best_val:,.2f}** की अधिकतम शुद्ध आय होगी। "
                        f"{rec.get('explanation_hi', '')}"
                    )
                else:
                    ans = (
                        f"For your {crop} batch (Quality: {quality:.0f}%, Remaining Shelf-Life: {shelf_hrs:.1f} hrs / {shelf_days} days), "
                        f"the optimal decision is **{rec.get('recommended_title', 'Sell Now')}**. "
                        f"Projected net realization is **₹{best_val:,.2f}**. "
                        f"{rec.get('explanation_en', '')}"
                    )
                return {
                    "answer": ans,
                    "language": "hi" if is_hindi else "en",
                    "grounded": True,
                    "uncertain": False,
                    "escalate_to_helpdesk": False,
                    "source": "batch_digital_twin_and_decision_engine"
                }

            # Match questions asking about shelf life or spoilage
            if any(w in q_lower for w in ["shelf", "life", "spoil", "decay", "quality", "expiry", "खराब", "सड़न", "गुणवत्ता", "कितने दिन"]):
                if is_hindi:
                    ans = (
                        f"आपके {crop_hi} बैच का डिजिटल ट्विन विश्लेषण दर्शाता है कि वर्तमान गुणवत्ता **{quality:.0f}%** "
                        f"और खराब होने का जोखिम **{risk:.0f}%** है। "
                        f"वर्तमान तापमान पर यह फसल अगले **{shelf_days} दिन ({shelf_hrs} घंटे)** तक सुरक्षित रूप से रखी जा सकती है।"
                    )
                else:
                    ans = (
                        f"Your {crop} batch has a computed quality score of **{quality:.0f}%** with a spoilage risk of **{risk:.0f}%**. "
                        f"At current ambient storage temperature, remaining safe shelf-life is approximately **{shelf_days} days ({shelf_hrs} hours)**."
                    )
                return {
                    "answer": ans,
                    "language": "hi" if is_hindi else "en",
                    "grounded": True,
                    "uncertain": False,
                    "escalate_to_helpdesk": False,
                    "source": "digital_twin_decay_engine"
                }

        # 2. Market Intelligence queries (e.g. "What is today's tomato price?", "मंडी भाव क्या है?")
        if any(w in q_lower for w in ["price", "mandi", "rate", "rate kya", "bhav", "market", "भाव", "रेट", "मंडी"]):
            if market_context:
                top_items = market_context[:3]
                if is_hindi:
                    lines = [f"• {m['crop']} ({m['mandi']}): ₹{m['modal_price_per_kg']}/किलो (रुझान: {m['trend']})" for m in top_items]
                    ans = "ताजा मंडी भाव (Agmarknet / eNAM लाइव):\n" + "\n".join(lines) + "\n\nआप किसी विशेष फसल या दूरी के अनुसार भी पूछ सकते हैं।"
                else:
                    lines = [f"• {m['crop']} at {m['mandi']}: ₹{m['modal_price_per_kg']}/kg (Trend: {m['trend']}, Arrivals: {m.get('arrivals_tonnes', 100)}T)" for m in top_items]
                    ans = "Latest Mandi Prices (Agmarknet / eNAM Synced):\n" + "\n".join(lines)
                return {
                    "answer": ans,
                    "language": "hi" if is_hindi else "en",
                    "grounded": True,
                    "uncertain": False,
                    "escalate_to_helpdesk": False,
                    "source": "agmarknet_market_feed"
                }

        # 3. Knowledge base match
        for doc in POST_HARVEST_KNOWLEDGE_BASE:
            if any(k in q_lower for k in doc["keywords"]):
                ans = doc["content_hi"] if is_hindi else doc["content_en"]
                return {
                    "answer": ans,
                    "language": "hi" if is_hindi else "en",
                    "grounded": True,
                    "uncertain": False,
                    "escalate_to_helpdesk": False,
                    "source": f"icar_kb_{doc['topic']}"
                }

        # Fallback with clear disclosure and escalation button
        if is_hindi:
            return {
                "answer": f"मुझे इस विशिष्ट प्रश्न का निश्चित उत्तर देने के लिए पर्याप्त लाइव डेटा नहीं मिला। गलत अनुमान लगाने के बजाय, मैं आपको {fpo_name} हेल्पडेस्क से जुड़ने की सलाह देता हूँ।",
                "language": "hi",
                "grounded": False,
                "uncertain": True,
                "escalate_to_helpdesk": True,
                "source": "fallback_confidence_guardrail"
            }
        else:
            return {
                "answer": f"I don't have high enough confidence or specific live telemetry to answer this question accurately. Rather than guessing, I recommend escalating this to your {fpo_name} expert desk.",
                "language": "en",
                "grounded": False,
                "uncertain": True,
                "escalate_to_helpdesk": True,
                "source": "fallback_confidence_guardrail"
            }
