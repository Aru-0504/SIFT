import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import Base, engine
from app.routers import watchlist, auth
from app.config import get_cors_origins, settings

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SIFT API",
    description="Stock Insight Filtering & Tracking — a watchlist with memory.",
    version="0.1.0",
)

origins = get_cors_origins()
allow_origins = origins
allow_origin_regex = None

if "*" in origins:
    allow_origins = []
    allow_origin_regex = ".*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(watchlist.router)
app.include_router(auth.router)


@app.get("/health")
def health():
    db_type = "sqlite" if (settings.database_url.startswith("sqlite") or engine.dialect.name == "sqlite") else "postgresql"
    return {
        "status": "ok",
        "environment": settings.app_env,
        "database": db_type,
    }


# Serve built frontend static assets if available (for single-service deployment)
dist_candidates = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static")),
]
frontend_dist = next((p for p in dist_candidates if os.path.isdir(p)), None)

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return {"detail": "Not found"}
