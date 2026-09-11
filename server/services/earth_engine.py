"""
ORBITAL Earth Engine Integration

Provides real multispectral data extraction from:
- Sentinel-2 L2A (10m optical, bands B2/B3/B4/B8/B11/B12)
- Sentinel-1 SAR (C-band VV/VH polarization)
- Landsat-8/9 (30m optical)

Requires authentication: run `earthengine authenticate` first.
"""

import ee
import numpy as np
from typing import Dict, Any, Optional
import os
import json

# ── Module-level state ──
_initialized = False
_init_error = None


def _ensure_initialized():
    """Lazy initialization — only connects to EE when first needed."""
    global _initialized, _init_error

    if _initialized:
        return True
    if _init_error:
        return False

    try:
        # Try service account first (for production/headless)
        sa_email = os.environ.get("EE_SERVICE_ACCOUNT", "")
        sa_key_path = os.environ.get("EE_KEY_PATH", "")

        if sa_email and sa_key_path and os.path.exists(sa_key_path):
            credentials = ee.ServiceAccountCredentials(sa_email, sa_key_path)
            ee.Initialize(credentials)
        else:
            # Fall back to browser-based auth (for development)
            ee_project = (
                os.environ.get("EE_PROJECT_ID")
                or os.environ.get("GOOGLE_CLOUD_PROJECT")
                or os.environ.get("GCP_PROJECT")
            )
            if not ee_project:
                # Check if project is recorded in credentials file
                creds_path = os.path.expanduser("~/.config/earthengine/credentials")
                if os.path.exists(creds_path):
                    try:
                        with open(creds_path, "r") as f:
                            c_data = json.load(f)
                            ee_project = c_data.get("project")
                    except Exception:
                        pass

            if ee_project:
                ee.Initialize(project=ee_project)
            else:
                ee.Initialize()

        _initialized = True
        return True
    except Exception as e:
        _init_error = str(e)
        return False


def check_earth_engine_status() -> Dict[str, Any]:
    """Checks if Earth Engine API is authenticated and initialized."""
    if _ensure_initialized():
        return {
            "status": "connected",
            "message": "Earth Engine authenticated and ready.",
            "has_real_sar": True,
            "has_real_multispectral": True,
        }

    return {
        "status": "unconfigured",
        "message": f"Earth Engine not connected: {_init_error or 'Run earthengine authenticate'}",
        "has_real_sar": False,
        "has_real_multispectral": False,
    }


def get_sentinel2_composite(
    lat: float, lon: float, year: int, buffer_m: int = 5000
) -> Dict[str, Any]:
    """
    Retrieves a real Sentinel-2 L2A median composite for the given location and year.
    Returns band statistics (B2, B3, B4, B8, B11, B12) and computed indices.
    """
    if not _ensure_initialized():
        return {"status": "unavailable", "error": _init_error}

    try:
        point = ee.Geometry.Point([lon, lat])
        aoi = point.buffer(buffer_m)

        # Filter Sentinel-2 L2A for the given year with cloud masking
        s2 = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(aoi)
            .filterDate(f"{year}-01-01", f"{year}-12-31")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        )

        count = s2.size().getInfo()
        if count == 0:
            return {
                "status": "no_data",
                "error": f"No Sentinel-2 scenes found for {year} at this location",
                "scene_count": 0,
            }

        # Cloud mask function
        def mask_s2_clouds(image):
            qa = image.select("QA60")
            cloud_bit = 1 << 10
            cirrus_bit = 1 << 11
            mask = qa.bitwiseAnd(cloud_bit).eq(0).And(qa.bitwiseAnd(cirrus_bit).eq(0))
            return image.updateMask(mask).divide(10000)  # Scale to 0-1

        composite = s2.map(mask_s2_clouds).median()

        # Extract band values
        bands = ["B2", "B3", "B4", "B8", "B11", "B12"]
        stats = composite.select(bands).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=10,
            maxPixels=1e8,
        ).getInfo()

        # Compute spectral indices
        b4 = stats.get("B4", 0)  # Red
        b3 = stats.get("B3", 0)  # Green
        b2 = stats.get("B2", 0)  # Blue
        b8 = stats.get("B8", 0)  # NIR
        b11 = stats.get("B11", 0)  # SWIR1
        b12 = stats.get("B12", 0)  # SWIR2

        ndvi = (b8 - b4) / (b8 + b4) if (b8 + b4) > 0 else 0
        ndwi = (b3 - b8) / (b3 + b8) if (b3 + b8) > 0 else 0
        ndbi = (b11 - b8) / (b11 + b8) if (b11 + b8) > 0 else 0

        return {
            "status": "success",
            "source": "Google Earth Engine — Sentinel-2 L2A",
            "scene_count": count,
            "year": year,
            "bands": stats,
            "indices": {
                "ndvi": round(ndvi, 4),
                "ndwi": round(ndwi, 4),
                "ndbi": round(ndbi, 4),
            },
            "data_quality": "real_multispectral",
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}


def get_sentinel1_sar(
    lat: float, lon: float, year: int, buffer_m: int = 5000
) -> Dict[str, Any]:
    """
    Retrieves real Sentinel-1 SAR backscatter (VV + VH) for the given location and year.
    Returns mean backscatter in dB.
    """
    if not _ensure_initialized():
        return {"status": "unavailable", "error": _init_error}

    try:
        point = ee.Geometry.Point([lon, lat])
        aoi = point.buffer(buffer_m)

        s1 = (
            ee.ImageCollection("COPERNICUS/S1_GRD")
            .filterBounds(aoi)
            .filterDate(f"{year}-01-01", f"{year}-12-31")
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
            .filter(ee.Filter.eq("instrumentMode", "IW"))
            .select(["VV", "VH"])
        )

        count = s1.size().getInfo()
        if count == 0:
            return {
                "status": "no_data",
                "error": f"No Sentinel-1 SAR scenes found for {year}",
                "scene_count": 0,
            }

        composite = s1.median()

        stats = composite.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=10,
            maxPixels=1e8,
        ).getInfo()

        vv_db = stats.get("VV", None)
        vh_db = stats.get("VH", None)

        # VV/VH ratio (useful for structural classification)
        vv_vh_ratio = (vv_db - vh_db) if vv_db and vh_db else None

        return {
            "status": "success",
            "source": "Google Earth Engine — Sentinel-1 GRD IW",
            "scene_count": count,
            "year": year,
            "backscatter": {
                "vv_db": round(vv_db, 2) if vv_db else None,
                "vh_db": round(vh_db, 2) if vh_db else None,
                "vv_vh_ratio_db": round(vv_vh_ratio, 2) if vv_vh_ratio else None,
            },
            "interpretation": interpret_sar(vv_db, vh_db),
            "data_quality": "real_sar",
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}


def interpret_sar(vv_db: Optional[float], vh_db: Optional[float]) -> str:
    """Interprets SAR backscatter values into land cover hints."""
    if vv_db is None:
        return "No SAR data"

    if vv_db > -5:
        return "Strong backscatter — likely urban/built-up structures or metallic surfaces"
    elif vv_db > -10:
        return "Moderate backscatter — mixed urban/vegetation, agricultural land with structures"
    elif vv_db > -15:
        return "Low-moderate backscatter — agricultural fields, sparse vegetation"
    elif vv_db > -20:
        return "Low backscatter — smooth surfaces (water, bare soil, roads)"
    else:
        return "Very low backscatter — calm water body or very smooth terrain"


def get_bitemporal_indices(
    lat: float, lon: float, year_a: int, year_b: int, buffer_m: int = 5000
) -> Dict[str, Any]:
    """
    Computes real spectral index changes between two years using Earth Engine.
    Returns NDVI, NDWI, NDBI deltas from actual Sentinel-2 data.
    """
    result_a = get_sentinel2_composite(lat, lon, year_a, buffer_m)
    result_b = get_sentinel2_composite(lat, lon, year_b, buffer_m)

    if result_a.get("status") != "success" or result_b.get("status") != "success":
        return {
            "status": "partial",
            "year_a": result_a,
            "year_b": result_b,
            "error": "Could not retrieve data for one or both years",
        }

    idx_a = result_a["indices"]
    idx_b = result_b["indices"]

    return {
        "status": "success",
        "year_a": year_a,
        "year_b": year_b,
        "deltas": {
            "ndvi_change": round(idx_b["ndvi"] - idx_a["ndvi"], 4),
            "ndwi_change": round(idx_b["ndwi"] - idx_a["ndwi"], 4),
            "ndbi_change": round(idx_b["ndbi"] - idx_a["ndbi"], 4),
        },
        "baseline": idx_a,
        "target": idx_b,
        "data_quality": "real_multispectral",
        "source": "Google Earth Engine — Sentinel-2 L2A Bi-Temporal",
    }


def get_ee_tile_url(
    lat: float, lon: float, year: int, layer_type: str = "ndvi",
    buffer_m: int = 10000
) -> Dict[str, Any]:
    """
    Generates a tile URL from Earth Engine for rendering on Google Maps.
    
    Supported layer_type: 'ndvi', 'ndwi', 'ndbi', 'true_color', 'false_color',
    'sar_vv', 'sar_vh', 'change_ndvi'
    """
    if not _ensure_initialized():
        return {"status": "unavailable", "error": _init_error}

    try:
        point = ee.Geometry.Point([lon, lat])
        aoi = point.buffer(buffer_m)

        vis_params = {}
        image = None

        if layer_type in ("ndvi", "ndwi", "ndbi", "true_color", "false_color"):
            s2 = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(aoi)
                .filterDate(f"{year}-01-01", f"{year}-12-31")
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            )
            if s2.size().getInfo() == 0:
                return {"status": "no_data", "error": f"No scenes for {year}"}

            def mask_clouds(img):
                qa = img.select("QA60")
                mask = qa.bitwiseAnd(1 << 10).eq(0).And(qa.bitwiseAnd(1 << 11).eq(0))
                return img.updateMask(mask).divide(10000)

            composite = s2.map(mask_clouds).median()

            if layer_type == "ndvi":
                image = composite.normalizedDifference(["B8", "B4"]).rename("NDVI")
                vis_params = {"min": -0.2, "max": 0.8, "palette": ["d73027", "fc8d59", "fee08b", "d9ef8b", "91cf60", "1a9850"]}
            elif layer_type == "ndwi":
                image = composite.normalizedDifference(["B3", "B8"]).rename("NDWI")
                vis_params = {"min": -0.5, "max": 0.5, "palette": ["a52a2a", "f5deb3", "87ceeb", "4169e1", "000080"]}
            elif layer_type == "ndbi":
                image = composite.normalizedDifference(["B11", "B8"]).rename("NDBI")
                vis_params = {"min": -0.3, "max": 0.3, "palette": ["006400", "90ee90", "f5deb3", "cd853f", "8b0000"]}
            elif layer_type == "true_color":
                image = composite.select(["B4", "B3", "B2"])
                vis_params = {"min": 0, "max": 0.3}
            elif layer_type == "false_color":
                image = composite.select(["B8", "B4", "B3"])
                vis_params = {"min": 0, "max": 0.4}

        elif layer_type in ("sar_vv", "sar_vh"):
            s1 = (
                ee.ImageCollection("COPERNICUS/S1_GRD")
                .filterBounds(aoi)
                .filterDate(f"{year}-01-01", f"{year}-12-31")
                .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
                .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
                .filter(ee.Filter.eq("instrumentMode", "IW"))
            )
            if s1.size().getInfo() == 0:
                return {"status": "no_data", "error": f"No SAR scenes for {year}"}

            composite = s1.median()
            band = "VV" if layer_type == "sar_vv" else "VH"
            image = composite.select(band)
            vis_params = {"min": -25, "max": 0, "palette": ["000000", "444444", "888888", "cccccc", "ffffff"]}

        if image is None:
            return {"status": "error", "error": f"Unknown layer type: {layer_type}"}

        # Generate tile URL
        map_id = image.getMapId(vis_params)
        tile_url = map_id["tile_fetcher"].url_format

        return {
            "status": "success",
            "tile_url": tile_url,
            "layer_type": layer_type,
            "year": year,
            "vis_params": vis_params,
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}


def get_enhanced_indices(
    lat: float, lon: float, year: int, buffer_m: int = 5000
) -> Dict[str, Any]:
    """
    Computes additional spectral indices beyond the basic NDVI/NDWI/NDBI:
    - EVI (Enhanced Vegetation Index)
    - SAVI (Soil-Adjusted Vegetation Index)
    - NDMI (Normalized Difference Moisture Index)
    - NBR (Normalized Burn Ratio)
    - MNDWI (Modified NDWI using SWIR)
    """
    if not _ensure_initialized():
        return {"status": "unavailable", "error": _init_error}

    try:
        point = ee.Geometry.Point([lon, lat])
        aoi = point.buffer(buffer_m)

        s2 = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(aoi)
            .filterDate(f"{year}-01-01", f"{year}-12-31")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        )

        count = s2.size().getInfo()
        if count == 0:
            return {"status": "no_data", "scene_count": 0}

        def mask_clouds(img):
            qa = img.select("QA60")
            mask = qa.bitwiseAnd(1 << 10).eq(0).And(qa.bitwiseAnd(1 << 11).eq(0))
            return img.updateMask(mask).divide(10000)

        composite = s2.map(mask_clouds).median()

        bands = ["B2", "B3", "B4", "B8", "B11", "B12"]
        stats = composite.select(bands).reduceRegion(
            reducer=ee.Reducer.mean(), geometry=aoi, scale=10, maxPixels=1e8
        ).getInfo()

        b2 = stats.get("B2", 0)
        b3 = stats.get("B3", 0)
        b4 = stats.get("B4", 0)
        b8 = stats.get("B8", 0)
        b11 = stats.get("B11", 0)
        b12 = stats.get("B12", 0)

        # Standard indices
        ndvi = (b8 - b4) / (b8 + b4) if (b8 + b4) > 0 else 0
        ndwi = (b3 - b8) / (b3 + b8) if (b3 + b8) > 0 else 0
        ndbi = (b11 - b8) / (b11 + b8) if (b11 + b8) > 0 else 0

        # Enhanced indices
        evi = 2.5 * ((b8 - b4) / (b8 + 6 * b4 - 7.5 * b2 + 1)) if (b8 + 6 * b4 - 7.5 * b2 + 1) != 0 else 0
        savi = ((b8 - b4) / (b8 + b4 + 0.5)) * 1.5 if (b8 + b4 + 0.5) > 0 else 0
        ndmi = (b8 - b11) / (b8 + b11) if (b8 + b11) > 0 else 0
        nbr = (b8 - b12) / (b8 + b12) if (b8 + b12) > 0 else 0
        mndwi = (b3 - b11) / (b3 + b11) if (b3 + b11) > 0 else 0

        return {
            "status": "success",
            "year": year,
            "scene_count": count,
            "indices": {
                "ndvi": round(ndvi, 4),
                "ndwi": round(ndwi, 4),
                "ndbi": round(ndbi, 4),
                "evi": round(evi, 4),
                "savi": round(savi, 4),
                "ndmi": round(ndmi, 4),
                "nbr": round(nbr, 4),
                "mndwi": round(mndwi, 4),
            },
            "data_quality": "real_multispectral",
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}

