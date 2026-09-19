@echo off
echo ================================================================
echo Starting AgriNexus - AI-Powered Post-Harvest Decision Platform
echo SIH 2026 Problem Statement 26193
echo ================================================================
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause