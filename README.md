# AgriNexus — AI-Powered Post-Harvest Decision Intelligence Platform
**Smart India Hackathon 2026 | Problem Statement ID: 26193**
*Theme: Agriculture, FoodTech & Rural Development*

AgriNexus is an AI-powered post-harvest decision intelligence platform designed to eliminate agricultural post-harvest loss and maximize farmer income. By combining continuous digital twin modeling of crop shelf-life, transparent multi-pathway decision optimization, cluster freight consolidation, and grounded conversational AI, AgriNexus empowers farmers and FPOs with actionable market decisions.

---

## 🚀 Key Features Built to SRS Specification

1. **Role-Based Experience**:
   - **Farmer**: Digital Twin cards, live shelf-life countdown, critical spoilage risk alerts (>70%), 2-tap decision confirmation.
   - **FPO Administrator**: Candidate cluster grouping, freight savings optimizer, 1-click confirmation & SMS blast to farmers, aggregated loss-avoided KPIs.
   - **Buyer / Processor**: Verified pooled lots ready for procurement.
   - **System Administrator**: $Q_{10}$ kinetic constants tuning, Agmarknet price overrides, health monitoring.

2. **Digital Twin & $Q_{10}$ Kinetic Degradation Engine (SRS Section 5.3.1)**:
   - Temperature heuristic doubling decay rate every 10°C rise above 20°C: $TF = 2^{\frac{T-20}{10}}$
   - Continuous quality computation: $\text{quality}(t) = 100 \times (1 - \frac{\text{hours\_elapsed}}{\text{effective\_shelf\_life}})$
   - Automatic color-coded risk alerts and trajectory forecasting.

3. **Transparent Decision Recommendation Engine (SRS Section 5.3.2)**:
   - Evaluates **Sell Now**, **Cold Store**, **Process**, and **Redirect to Terminal Market**.
   - Fully auditable mathematical formulas displayed to eliminate black-box distrust.

4. **Cluster Pooling Freight Optimizer (SRS Section 3.6)**:
   - Groups nearby harvests within a locality radius.
   - Slashes per-kg transport expenses from ~₹4.50/kg to ~₹1.80/kg (saving ~60%).

5. **AgriNexus Assist — Grounded AI Agronomist (SRS Section 3.9 & 5.3.3)**:
   - Grounded RAG conversational layer operating in English and Hindi (हिंदी).
   - Voice speech-to-text recording and text-to-speech audio playback.
   - Confidence guardrails with 1-click escalation to the FPO Helpdesk.

6. **What-If Scenario Simulator (SRS Section 3.8)**:
   - Real-time sliders for transport delays, storage duration, weather temperature, and price swings.

7. **Offline-First Resilience (SRS FR-1.6 & NFR-4.2)**:
   - Local queuing of batch registrations and automatic background sync on reconnection.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.14, FastAPI, SQLAlchemy, SQLite (pre-seeded with Indian mandis & crops), Uvicorn.
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Web Speech API (Voice STT/TTS).
- **Localization**: Full Bilingual Support (English & Hindi).

---

## 🏃 Running the Application

### Option 1: Start Backend (Serves API + Built Frontend Dashboard)
```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

### Option 2: Run Frontend Development Server
```bash
cd frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Running Backend Unit Tests
```bash
cd backend
python -m pytest tests
```