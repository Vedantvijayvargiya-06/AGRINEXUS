import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import init_db
from app.api.auth import router as auth_router
from app.api.batches import router as batches_router
from app.api.decisions import router as decisions_router
from app.api.clusters import router as clusters_router
from app.api.market import router as market_router
from app.api.assist import router as assist_router
from app.api.reports import router as reports_router
from app.api.notifications import router as notif_router
from app.api.admin import router as admin_router

app = FastAPI(
    title="AgriNexus API",
    description="AI-Powered Post-Harvest Decision Intelligence Platform (SIH 2026)",
    version="1.0.0"
)

# Enable CORS for local dev / client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include All Feature Routers
app.include_router(auth_router, prefix="/api")
app.include_router(batches_router, prefix="/api")
app.include_router(decisions_router, prefix="/api")
app.include_router(clusters_router, prefix="/api")
app.include_router(market_router, prefix="/api")
app.include_router(assist_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(notif_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "app": "AgriNexus Decision Intelligence Service",
        "version": "1.0.0",
        "theme": "SIH 2026 - Problem Statement 26193"
    }

# Mount Frontend Dist if built
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            return {"error": "API route not found"}
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "Frontend build not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)