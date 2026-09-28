from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
import logging

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def normalize_database_url(url: str) -> str:
    cleaned = (url or "").strip()
    if cleaned.startswith("postgres://"):
        cleaned = "postgresql://" + cleaned[len("postgres://"):]
    return cleaned


def create_database_engine():
    """Create database engine with SQLite fallback if Neon/Postgres fails in dev"""
    db_url = normalize_database_url(settings.database_url)

    # Try PostgreSQL first if configured
    if not db_url.startswith("sqlite"):
        try:
            engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_recycle=300,
            )
            # Test connection using SQLAlchemy 2.0 text()
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Successfully connected to PostgreSQL database")
            return engine
        except Exception as e:
            if settings.app_env == "production":
                logger.error(f"Failed to connect to PostgreSQL in production: {e}")
                raise
            logger.warning(f"Failed to connect to PostgreSQL: {e}. Falling back to SQLite for local development.")

    # Fallback to SQLite
    sqlite_url = db_url if db_url.startswith("sqlite") else "sqlite:///./sift_dev.db"
    connect_args = {"check_same_thread": False}
    engine = create_engine(sqlite_url, connect_args=connect_args)
    logger.info(f"Using SQLite database ({sqlite_url})")
    return engine

engine = create_database_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
