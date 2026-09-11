"""
ORBITAL Server Configuration

Centralized config — loads from environment variables.
Sensitive keys are NEVER exposed to the frontend.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# ── Groq AI (server-side only, OpenAI-compatible) ──
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# ── Google Maps (browser-restricted, OK to expose via VITE_) ──
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")

# ── Earth Engine ──
EARTH_ENGINE_PROJECT = os.environ.get("EE_PROJECT_ID", "")
EARTH_ENGINE_SERVICE_ACCOUNT = os.environ.get("EE_SERVICE_ACCOUNT", "")
EARTH_ENGINE_KEY_PATH = os.environ.get("EE_KEY_PATH", "")

# ── Database (PostgreSQL + PostGIS) ──
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://orbital_admin:orbital_password@localhost:5432/orbital_mission_db"
)

# ── STAC APIs ──
COPERNICUS_STAC_URL = "https://catalogue.dataspace.copernicus.eu/stac/search"
PLANETARY_COMPUTER_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"

# ── Server ──
SERVER_HOST = os.environ.get("ORBITAL_HOST", "127.0.0.1")
SERVER_PORT = int(os.environ.get("ORBITAL_PORT", "8000"))
DEBUG = os.environ.get("ORBITAL_DEBUG", "false").lower() == "true"
