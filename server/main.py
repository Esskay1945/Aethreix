"""
ORBITAL FastAPI Backend Server
Entrypoint for the Agentic Multimodal Earth Observation Intelligence Platform.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uvicorn
import os

from server.agent.orchestrator import OrbitalAgent
from server.models.change_detector import run_bitemporal_change_detection
from server.services.location import resolve_location, reverse_geocode
from server.services.earth_engine import check_earth_engine_status

app = FastAPI(
    title="ORBITAL — Agentic Multimodal Intelligence for Earth Observation",
    description="Backend API for SIH26167 SatQuery AI: Optical, SAR, and Bi-Temporal Analysis",
    version="2.0.0"
)

# Enable CORS for the Aethreix React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = OrbitalAgent()


# ═══════════════════════════════════════════════════════════════════════════
# REQUEST MODELS
# ═══════════════════════════════════════════════════════════════════════════

class QueryRequest(BaseModel):
    query: str
    location: Dict[str, Any] = Field(..., description="Contains lat, lon, name, cameraAlt")
    selectedYear: Optional[int] = 2024
    aoi: Optional[Dict[str, Any]] = None  # GeoJSON geometry for AOI
    image_base64: Optional[str] = None


class ChangeRequest(BaseModel):
    latitude: float
    longitude: float
    year_baseline: int = 2020
    year_target: int = 2026
    radius_km: Optional[float] = 3.5


class MissionRequest(BaseModel):
    query: str
    location: Dict[str, Any]
    aoi: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None


class LocationRequest(BaseModel):
    query: str


class ReverseGeocodeRequest(BaseModel):
    lat: float
    lon: float


# ═══════════════════════════════════════════════════════════════════════════
# HEALTH & STATUS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/orbital/health")
@app.get("/api/status")
@app.get("/health")
def health_check():
    ee_status = check_earth_engine_status()
    return {
        "status": "online",
        "system": "ORBITAL Agentic Engine v2.0",
        "specification": "SIH26167 SatQuery AI",
        "specialists_active": [
            "OpticalVQASpecialist",
            "BiTemporalChangeSpecialist (CVA Differencing)",
            "SARFusionSpecialist (Sentinel-1 VV/VH)",
            "VisualGeolocationSpecialist",
            "Copernicus_STAC_Pipeline"
        ],
        "earth_engine": ee_status,
        "stac_endpoint": "https://catalogue.dataspace.copernicus.eu/stac",
        "evidential_calibration": "ENABLED",
        "data_honesty": "No simulated data. All outputs are real or explicitly marked as unavailable.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# CORE QUERY ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

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
            "selectedYear": req.selectedYear or 2024,
            "image_base64": req.image_base64,
            "aoi": req.aoi,
        }
        result = agent.execute_pipeline(req.query, context)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORBITAL Agent Execution Error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════
# CHANGE DETECTION
# ═══════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════
# LOCATION SERVICES
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/location/geocode")
def geocode(req: LocationRequest):
    """Forward geocode: name/address/coordinates → structured location."""
    result = resolve_location(req.query)
    if not result:
        raise HTTPException(status_code=404, detail="Location not found")
    return result


@app.post("/api/location/reverse")
def reverse(req: ReverseGeocodeRequest):
    """Reverse geocode: coordinates → address and place info."""
    result = reverse_geocode(req.lat, req.lon)
    if not result:
        raise HTTPException(status_code=404, detail="Could not reverse geocode this location")
    return result

# ═══════════════════════════════════════════════════════════════════════════
# EARTH ENGINE — Real Multispectral & SAR Data
# ═══════════════════════════════════════════════════════════════════════════

from server.services.earth_engine import (
    get_sentinel2_composite,
    get_sentinel1_sar,
    get_bitemporal_indices,
    get_ee_tile_url,
    get_enhanced_indices,
)


class EERequest(BaseModel):
    lat: float
    lon: float
    year: int = 2024
    buffer_m: int = 5000


class EEBitemporalRequest(BaseModel):
    lat: float
    lon: float
    year_a: int = 2020
    year_b: int = 2024
    buffer_m: int = 5000


@app.post("/api/ee/sentinel2")
def ee_sentinel2(req: EERequest):
    """Get real Sentinel-2 multispectral composite and spectral indices."""
    return get_sentinel2_composite(req.lat, req.lon, req.year, req.buffer_m)


@app.post("/api/ee/sentinel1")
def ee_sentinel1(req: EERequest):
    """Get real Sentinel-1 SAR backscatter (VV/VH)."""
    return get_sentinel1_sar(req.lat, req.lon, req.year, req.buffer_m)


@app.post("/api/ee/bitemporal")
def ee_bitemporal(req: EEBitemporalRequest):
    """Get real bi-temporal spectral index comparison from Earth Engine."""
    return get_bitemporal_indices(req.lat, req.lon, req.year_a, req.year_b, req.buffer_m)


class EETileRequest(BaseModel):
    lat: float
    lon: float
    year: int = 2024
    layer_type: str = "ndvi"  # ndvi | ndwi | ndbi | true_color | false_color | sar_vv | sar_vh
    buffer_m: int = 10000


@app.post("/api/ee/tiles")
def ee_tiles(req: EETileRequest):
    """Get Earth Engine tile URL for rendering analysis layers on the map."""
    return get_ee_tile_url(req.lat, req.lon, req.year, req.layer_type, req.buffer_m)


@app.post("/api/ee/enhanced-indices")
def ee_enhanced(req: EERequest):
    """Get all 8 spectral indices (NDVI, NDWI, NDBI, EVI, SAVI, NDMI, NBR, MNDWI)."""
    return get_enhanced_indices(req.lat, req.lon, req.year, req.buffer_m)


# ═══════════════════════════════════════════════════════════════════════════
# MISSION SYSTEM — SSE Streaming Autonomous Agent
# ═══════════════════════════════════════════════════════════════════════════

from fastapi.responses import StreamingResponse
import asyncio
import json as json_lib
import time as time_mod

missions_store: Dict[str, Dict[str, Any]] = {}


@app.post("/api/mission")
def create_mission(req: MissionRequest):
    """Create a new investigation mission."""
    mission_id = f"mission_{int(time_mod.time() * 1000)}"
    mission = {
        "id": mission_id,
        "query": req.query,
        "location": req.location,
        "aoi": req.aoi,
        "status": "created",
        "progress": 0,
        "steps": [],
        "results": None,
        "created_at": time_mod.time(),
    }
    missions_store[mission_id] = mission
    return mission


@app.get("/api/mission/{mission_id}")
def get_mission(mission_id: str):
    """Get mission status and results."""
    if mission_id not in missions_store:
        raise HTTPException(status_code=404, detail="Mission not found")
    return missions_store[mission_id]


@app.get("/api/mission/{mission_id}/stream")
async def stream_mission(mission_id: str):
    """
    SSE endpoint: streams real-time mission progress events.
    Each event is a JSON object with type, step name, status, and data.
    The frontend connects via EventSource and receives live updates.
    """
    if mission_id not in missions_store:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission = missions_store[mission_id]

    async def event_generator():
        lat = mission["location"].get("lat", 19.3)
        lon = mission["location"].get("lon", 73.209)
        loc_name = mission["location"].get("name", "Target")
        query = mission["query"]

        def emit(event_type, data):
            return f"event: {event_type}\ndata: {json_lib.dumps(data)}\n\n"

        # Step 0: Mission started
        mission["status"] = "running"
        yield emit("mission_start", {
            "mission_id": mission_id,
            "query": query,
            "location": loc_name,
        })
        await asyncio.sleep(0.1)

        # Step 1: Intent Parsing
        yield emit("step_start", {"step": "intent_parsing", "name": "Analyzing Query Intent", "progress": 5})
        mission["progress"] = 5
        plan = agent.parse_intent(query)
        mission["steps"].append({"name": "Intent Parsing", "status": "done", "result": plan})
        yield emit("step_done", {"step": "intent_parsing", "name": "Query Intent Analyzed", "progress": 10, "result": plan})
        await asyncio.sleep(0.1)

        # Step 2: STAC Discovery
        yield emit("step_start", {"step": "stac_discovery", "name": "Searching Satellite Catalogs", "progress": 15})
        mission["progress"] = 15
        from server.data.stac_pipeline import query_stac_scenes
        stac_scenes = query_stac_scenes(lat, lon, plan["from_year"], plan["to_year"])
        stac_count = len(stac_scenes)
        mission["steps"].append({"name": "STAC Discovery", "status": "done", "result": {"scenes": stac_count}})
        yield emit("step_done", {"step": "stac_discovery", "name": f"Found {stac_count} Satellite Scenes", "progress": 25})
        await asyncio.sleep(0.1)

        # Step 3: Optical Analysis (Earth Engine)
        yield emit("step_start", {"step": "optical_analysis", "name": "Running Multispectral Analysis", "progress": 30})
        mission["progress"] = 30
        selected_year = plan.get("to_year", 2024)
        specialist_ctx = {
            "lat": lat, "lon": lon, "name": loc_name,
            "year": selected_year,
            "from_year": plan["from_year"], "to_year": plan["to_year"],
        }
        optical_out = agent.optical_specialist.execute(query, specialist_ctx)
        mission["steps"].append({"name": "Optical Analysis", "status": "done", "data_quality": optical_out.get("data_quality", "unknown")})
        yield emit("step_done", {
            "step": "optical_analysis",
            "name": f"Multispectral Analysis Complete ({optical_out.get('data_quality', 'unknown')})",
            "progress": 45,
        })
        await asyncio.sleep(0.1)

        change_out = None
        sar_out = None

        # Step 4: Change Detection (if temporal query)
        if plan["requires_multitemporal"]:
            yield emit("step_start", {"step": "change_detection", "name": f"Bi-Temporal Change Detection ({plan['from_year']}-{plan['to_year']})", "progress": 50})
            mission["progress"] = 50
            change_out = agent.change_specialist.execute(query, specialist_ctx)
            mission["steps"].append({"name": "Change Detection", "status": "done", "data_status": change_out.get("data_status")})
            yield emit("step_done", {
                "step": "change_detection",
                "name": f"Change Detection Complete ({change_out.get('data_status', 'unknown')})",
                "progress": 65,
            })
            await asyncio.sleep(0.1)

        # Step 5: SAR Verification
        if plan["requires_sar"]:
            yield emit("step_start", {"step": "sar_verification", "name": "SAR Structural Cross-Validation", "progress": 70})
            mission["progress"] = 70
            sar_out = agent.sar_specialist.execute(optical_out, specialist_ctx)
            mission["steps"].append({"name": "SAR Verification", "status": "done", "sar_status": sar_out.get("status")})
            yield emit("step_done", {
                "step": "sar_verification",
                "name": f"SAR Verification: {sar_out.get('structural_verification', 'N/A')}",
                "progress": 80,
            })
            await asyncio.sleep(0.1)

        # Step 6: Evidence Fusion
        yield emit("step_start", {"step": "evidence_fusion", "name": "Fusing Multi-Sensor Evidence", "progress": 85})
        mission["progress"] = 85
        from server.agent.fusion import calculate_calibrated_confidence
        confidence_pct, is_abstained, abstention_reason = calculate_calibrated_confidence(
            optical_out, sar_out, change_out
        )
        yield emit("step_done", {
            "step": "evidence_fusion",
            "name": f"Evidence Fusion — Confidence: {confidence_pct}%",
            "progress": 90,
            "confidence": confidence_pct,
        })
        await asyncio.sleep(0.1)

        # Step 7: Compile final results through orchestrator
        yield emit("step_start", {"step": "report_generation", "name": "Generating Intelligence Report", "progress": 92})
        mission["progress"] = 92
        context = {
            "lat": lat, "lon": lon, "name": loc_name,
            "selectedYear": selected_year,
        }
        full_result = agent.execute_pipeline(query, context)
        mission["results"] = full_result
        mission["status"] = "complete"
        mission["progress"] = 100
        mission["steps"].append({"name": "Report Generation", "status": "done"})

        yield emit("step_done", {"step": "report_generation", "name": "Intelligence Report Ready", "progress": 100})
        await asyncio.sleep(0.05)

        # Final: emit complete result
        yield emit("mission_complete", {
            "mission_id": mission_id,
            "confidence": confidence_pct,
            "result": full_result,
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ═══════════════════════════════════════════════════════════════════════════
# MISTRAL AI PROXY — Keeps API key server-side
# ═══════════════════════════════════════════════════════════════════════════

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


class LLMProxyRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: str = "qwen/qwen3.8-27b"
    temperature: float = 0.4
    stream: bool = False
    max_tokens: int = 2048


@app.post("/api/ai/chat")
async def groq_proxy(req: LLMProxyRequest):
    """
    Proxies chat requests to Groq API (OpenAI-compatible), keeping the API key on the server.
    Frontend should call this instead of calling any LLM API directly.
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Groq API key not configured. Set GROQ_API_KEY environment variable.")

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": req.model,
                    "messages": req.messages,
                    "temperature": req.temperature,
                    "max_tokens": req.max_tokens,
                    "stream": req.stream,
                },
                timeout=30.0,
            )
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Groq API timeout")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("server.main:app", host="127.0.0.1", port=8000, reload=True)
