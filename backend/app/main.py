from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import watchlist, auth
from app.config import get_cors_origins, settings

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SIFT API",
    description="Stock Insight Filtering & Tracking — a watchlist with memory.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(watchlist.router)
app.include_router(auth.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "environment": settings.app_env,
        "database": "sqlite" if settings.database_url.startswith("sqlite") else "postgresql",
    }
