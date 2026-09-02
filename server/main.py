"""
ORBITAL FastAPI Backend Server
Entrypoint for the Agentic Multimodal Earth Observation Intelligence Platform.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import uvicorn

from server.agent.orchestrator import OrbitalAgent
from server.models.change_detector import run_bitemporal_change_detection

app = FastAPI(
    title="ORBITAL — Agentic Multimodal Intelligence for Earth Observation",
    description="Backend API for SIH26167 SatQuery AI: Optical, SAR, and Bi-Temporal Analysis",
    version="1.0.0"
)

# Enable CORS for the Aethrix React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = OrbitalAgent()


class QueryRequest(BaseModel):
    query: str
    location: Dict[str, Any] = Field(..., description="Contains lat, lon, name, cameraAlt")
    selectedYear: Optional[int] = 2024


class ChangeRequest(BaseModel):
    latitude: float
    longitude: float
    year_baseline: int = 2020
    year_target: int = 2026
    radius_km: Optional[float] = 3.5


@app.get("/api/orbital/health")
def health_check():
    return {
        "status": "online",
        "system": "ORBITAL Agentic Engine",
        "specification": "SIH26167 SatQuery AI",
        "specialists_active": [
            "OpticalVQASpecialist",
            "BiTemporalChangeSpecialist (CVA Differencing)",
            "SARFusionSpecialist (Sentinel-1 VV/VH)",
            "Copernicus_STAC_Pipeline"
        ],
        "stac_endpoint": "https://catalogue.dataspace.copernicus.eu/stac",
        "evidential_calibration": "ENABLED"
    }


@app.post("/api/orbital/query")
def process_query(req: QueryRequest):
    """
    Main agent endpoint: Decomposes natural-language questions, dynamically calls
    specialist vision models, runs change detection and SAR verification, and returns
    evidence-grounded analysis + GeoJSON masks.
    """
    try:
        context = {
            "lat": req.location.get("lat", 19.3),
            "lon": req.location.get("lon", 73.209),
            "name": req.location.get("name", "Target Location"),
            "cameraAlt": req.location.get("cameraAlt", 5000),
            "selectedYear": req.selectedYear or 2024
        }
        result = agent.execute_pipeline(req.query, context)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORBITAL Agent Execution Error: {str(e)}")


@app.post("/api/orbital/change")
def compute_change(req: ChangeRequest):
    """
    Direct bi-temporal change detection endpoint:
    Returns quantitative land-cover change metrics and GeoJSON polygons.
    """
    try:
        result = run_bitemporal_change_detection(
            lat=req.latitude,
            lon=req.longitude,
            year_a=req.year_baseline,
            year_b=req.year_target,
            radius_km=req.radius_km or 3.5
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Change Detection Error: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("server.main:app", host="127.0.0.1", port=8000, reload=True)
