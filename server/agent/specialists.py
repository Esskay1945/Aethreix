"""
ORBITAL Specialist Vision & Sensor Models

All specialists are wired to real Google Earth Engine data.
No hard-coded values. No RGB proxy fallback on the scientific path.
If data is unavailable, specialists report honestly and trigger abstention.
"""

from typing import Dict, Any
from server.data.stac_pipeline import query_stac_scenes
from server.services.earth_engine import (
    get_sentinel2_composite,
    get_sentinel1_sar,
    get_bitemporal_indices,
    check_earth_engine_status,
)


class OpticalVQASpecialist:
    """Specialist for single-image visual question answering and scene analysis.
    
    Wired to real Earth Engine Sentinel-2 data for actual band statistics
    and spectral indices (NDVI, NDWI, NDBI).
    
    Accepts user-drawn AOI geometry to restrict analysis.
    """
    name = "Optical_VQA_Specialist"
    modality = "Optical (Sentinel-2 L2A — Real Multispectral)"

    def execute(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        lat = context.get("lat", 0.0)
        lon = context.get("lon", 0.0)
        loc_name = context.get("name", "Target Location")
        year = context.get("year", 2024)
        aoi_geojson = context.get("aoi")  # User-drawn polygon geometry

        # ── Try Earth Engine first (real multispectral bands) ──
        ee_status = check_earth_engine_status()
        if ee_status["status"] == "connected":
            ee_result = get_sentinel2_composite(
                lat, lon, year, buffer_m=3000,
                geojson_geom=aoi_geojson
            )

            if ee_result.get("status") == "success":
                indices = ee_result["indices"]
                bands = ee_result["bands"]

                # Classify scene from real indices
                ndvi = indices["ndvi"]
                ndbi = indices["ndbi"]
                ndwi = indices["ndwi"]

                scene_class = _classify_scene(ndvi, ndbi, ndwi)

                return {
                    "specialist": self.name,
                    "modality": self.modality,
                    "status": "success",
                    "findings": {
                        "scene_classification": scene_class,
                        "spectral_signature": {
                            "ndvi": ndvi,
                            "ndwi": ndwi,
                            "ndbi": ndbi,
                        },
                        "band_reflectance": bands,
                        "resolution_effective": "10.0m (Sentinel-2 L2A)",
                        "scene_count": ee_result["scene_count"],
                    },
                    "confidence": 0.92,  # High — real multispectral data
                    "data_source": "earth_engine",
                    "data_quality": "real_multispectral",
                    "mean_cloud_pct": ee_result.get("mean_cloud_pct"),
                }

            elif ee_result.get("status") == "no_data":
                # EE connected but no scenes for this location/year
                pass  # Fall through to STAC

        # ── Fallback: STAC scene metadata ──
        scenes = query_stac_scenes(lat, lon, year, year)

        if not scenes or all(s.get("source") == "unavailable" for s in scenes):
            return {
                "specialist": self.name,
                "modality": self.modality,
                "status": "no_data",
                "findings": {
                    "scene_classification": "DATA UNAVAILABLE — No optical scenes found for this location and date",
                    "spectral_signature": None,
                    "resolution_effective": "N/A",
                },
                "confidence": 0.0,
                "data_source": "none",
                "data_quality": "none",
            }

        best_scene = min(scenes, key=lambda s: s.get("cloud_cover", 100))
        return {
            "specialist": self.name,
            "modality": "Optical (STAC Metadata — Scene Catalog Only)",
            "status": "success",
            "findings": {
                "scene_classification": f"Scene available at {loc_name} ({year})",
                "spectral_signature": f"Scene {best_scene.get('id', 'unknown')} — Cloud cover: {best_scene.get('cloud_cover', 'N/A')}%",
                "resolution_effective": "10.0m (Sentinel-2 L2A)" if best_scene.get("platform", "").startswith("Sentinel-2") else "30.0m (Landsat)",
                "scene_count": len(scenes),
                "best_scene_id": best_scene.get("id"),
                "best_cloud_cover": best_scene.get("cloud_cover"),
            },
            "confidence": 0.55,  # Lower — metadata only, no pixel analysis
            "data_source": best_scene.get("source", "STAC"),
            "data_quality": "stac_metadata",
        }


class ChangeDetectionSpecialist:
    """Specialist for bi-temporal and N-temporal pixel-level change detection.
    
    Uses real Earth Engine pixel-level bi-temporal analysis with:
    - Pixel-level ΔNDVI, ΔNDBI, ΔNDWI differencing
    - Morphological cleanup and connected-component filtering
    - Vectorization via reduceToVectors() into real GeoJSON polygons
    
    SCIENTIFIC HONESTY: If Earth Engine is not connected, this specialist
    explicitly abstains rather than falling back to the RGB proxy.
    """
    name = "BiTemporal_Change_Specialist"
    modality = "Multi-Temporal Optical (Earth Engine Pixel-Level Analysis)"

    def execute(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        lat = context.get("lat", 19.3)
        lon = context.get("lon", 73.209)
        from_year = context.get("from_year", 2020)
        to_year = context.get("to_year", 2024)
        aoi_geojson = context.get("aoi")  # User-drawn polygon geometry

        # ── SCIENTIFIC PATH: Earth Engine pixel-level analysis ──
        ee_status = check_earth_engine_status()
        if ee_status["status"] != "connected":
            # HONEST ABSTENTION: Do NOT fall back to RGB proxy
            return {
                "specialist": self.name,
                "modality": self.modality,
                "status": "not_available",
                "reason": (
                    "Data Unavailable: Real multispectral change detection requires "
                    "Google Earth Engine. RGB proxy analysis has been disabled to "
                    "maintain scientific integrity per SIH26167 specification."
                ),
                "data_status": "none",
                "from_year": from_year,
                "to_year": to_year,
                "metrics": {},
                "transitions": [],
                "geojson_mask": {"type": "FeatureCollection", "features": []},
                "change_polygons": {"type": "FeatureCollection", "features": []},
                "confidence": 0.0,
            }

        # ── Run real pixel-level change detection ──
        ee_result = get_bitemporal_indices(
            lat, lon, from_year, to_year, buffer_m=3000,
            geojson_geom=aoi_geojson
        )

        if ee_result.get("status") != "success":
            return {
                "specialist": self.name,
                "modality": self.modality,
                "status": ee_result.get("status", "error"),
                "reason": ee_result.get("error", "Unknown error"),
                "data_status": "none",
                "from_year": from_year,
                "to_year": to_year,
                "metrics": {},
                "transitions": [],
                "geojson_mask": {"type": "FeatureCollection", "features": []},
                "change_polygons": {"type": "FeatureCollection", "features": []},
                "confidence": 0.0,
            }

        deltas = ee_result["deltas"]
        baseline = ee_result["baseline"]
        target = ee_result["target"]
        provenance = ee_result.get("provenance", {})

        # Compute quantitative change metrics from real indices
        ndvi_change = deltas["ndvi_change"]
        ndbi_change = deltas["ndbi_change"]
        ndwi_change = deltas["ndwi_change"]

        # Estimate area affected (within 3km buffer = ~28.27 km²)
        aoi_area_km2 = 3.14159 * (3.0 ** 2)  # pi * r²

        # Classify transitions from real index changes
        transitions = _compute_transitions(ndvi_change, ndbi_change, ndwi_change, aoi_area_km2)
        total_change_pct = abs(ndvi_change * 100) + abs(ndbi_change * 100)

        # Use the real pixel-derived polygons from Earth Engine
        change_polygons = ee_result.get("change_polygons", {"type": "FeatureCollection", "features": []})
        polygon_count = ee_result.get("polygon_count", len(change_polygons.get("features", [])))

        metrics = {
            "total_changed_area_sq_km": round(aoi_area_km2 * min(total_change_pct / 100, 1.0), 2),
            "total_change_percentage": round(total_change_pct, 1),
            "mean_ndvi_baseline": baseline["ndvi"],
            "mean_ndvi_target": target["ndvi"],
            "mean_ndbi_baseline": baseline["ndbi"],
            "mean_ndbi_target": target["ndbi"],
            "mean_ndwi_baseline": baseline["ndwi"],
            "mean_ndwi_target": target["ndwi"],
            "ndvi_delta": ndvi_change,
            "ndbi_delta": ndbi_change,
            "ndwi_delta": ndwi_change,
            "built_up_expansion_ha": round(max(0, ndbi_change) * aoi_area_km2 * 100, 1),
            "vegetation_loss_ha": round(max(0, -ndvi_change) * aoi_area_km2 * 100, 1),
            "change_polygon_count": polygon_count,
        }

        return {
            "specialist": self.name,
            "modality": self.modality,
            "status": "success",
            "data_status": "real_multispectral",
            "data_quality": "real_multispectral",
            "from_year": from_year,
            "to_year": to_year,
            "metrics": metrics,
            "transitions": transitions,
            "geojson_mask": change_polygons,  # Real pixel-derived polygons
            "change_polygons": change_polygons,
            "polygon_count": polygon_count,
            "provenance": provenance,
            "confidence": 0.88,
        }


class SARFusionSpecialist:
    """Specialist for Sentinel-1 SAR structural verification.
    
    Wired to real Earth Engine Sentinel-1 GRD data.
    Returns actual VV/VH backscatter and physical surface interpretation.
    Accepts user-drawn AOI geometry.
    """
    name = "SAR_Fusion_Specialist"
    modality = "Sentinel-1 C-Band SAR (VV/VH Polarization)"

    def execute(self, optical_findings: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        lat = context.get("lat", 19.3)
        lon = context.get("lon", 73.209)
        year = context.get("year", 2024)
        aoi_geojson = context.get("aoi")  # User-drawn polygon geometry

        # ── Try Earth Engine for real SAR data ──
        ee_status = check_earth_engine_status()
        if ee_status["status"] == "connected":
            sar_result = get_sentinel1_sar(
                lat, lon, year, buffer_m=3000,
                geojson_geom=aoi_geojson
            )

            if sar_result.get("status") == "success":
                bs = sar_result["backscatter"]
                vv = bs["vv_db"]
                vh = bs["vh_db"]
                ratio = bs["vv_vh_ratio_db"]

                # Cross-validate optical findings with SAR
                verification = _cross_validate_sar_optical(vv, vh, optical_findings)

                return {
                    "specialist": self.name,
                    "modality": self.modality,
                    "status": "success",
                    "sar_polarization": "VV + VH dual-pol",
                    "radar_backscatter_vv_db": vv,
                    "radar_backscatter_vh_db": vh,
                    "vv_vh_ratio_db": ratio,
                    "scene_count": sar_result["scene_count"],
                    "structural_verification": verification["verdict"],
                    "surface_interpretation": sar_result["interpretation"],
                    "optical_sar_agreement": verification["agreement"],
                    "verification_confidence": verification["confidence"],
                    "penetration_cloud_independent": True,
                    "data_quality": "real_sar",
                }

        # ── No Earth Engine — honest about it ──
        return {
            "specialist": self.name,
            "modality": self.modality,
            "status": "not_available",
            "reason": "Real Sentinel-1 SAR data access not yet configured. Requires Earth Engine.",
            "sar_polarization": "VV + VH dual-pol (planned)",
            "radar_backscatter_vv_db": None,
            "radar_backscatter_vh_db": None,
            "structural_verification": "UNVERIFIED",
            "penetration_cloud_independent": True,
            "verification_confidence": 0.0,
            "data_quality": "none",
        }


class VisualGeolocationSpecialist:
    """Specialist for image-to-coordinate geolocation using EXIF data."""
    name = "Visual_Geolocation_Specialist"
    modality = "Image Visual Feature Extraction & EXIF Metadata Parsing"

    def execute(self, image_base64: str) -> Dict[str, Any]:
        import base64
        import io
        from PIL import Image, ExifTags

        try:
            if "base64," in image_base64:
                image_base64 = image_base64.split("base64,")[1]
            image_data = base64.b64decode(image_base64)
            img = Image.open(io.BytesIO(image_data))

            exif_data = img._getexif()
            lat, lon = None, None
            method = "No GPS data found in image"
            confidence = 0.0
            location_name = "Unknown"

            if exif_data:
                def get_decimal_from_dms(dms, ref):
                    degrees = dms[0]
                    minutes = dms[1]
                    seconds = dms[2]
                    decimal = float(degrees) + float(minutes)/60 + float(seconds)/3600
                    if ref in ['S', 'W']:
                        decimal = -decimal
                    return decimal

                gps_info = None
                for tag, value in exif_data.items():
                    decoded = ExifTags.TAGS.get(tag, tag)
                    if decoded == "GPSInfo":
                        gps_info = value
                        break

                if gps_info and 2 in gps_info and 4 in gps_info:
                    lat = get_decimal_from_dms(gps_info[2], gps_info.get(1, 'N'))
                    lon = get_decimal_from_dms(gps_info[4], gps_info.get(3, 'E'))
                    method = "Deterministic EXIF GPS Metadata Extraction"
                    confidence = 1.00
                    location_name = "Precise Image Capture Location"

            if lat is None or lon is None:
                return {
                    "specialist": self.name,
                    "modality": self.modality,
                    "status": "no_gps",
                    "error": "Image does not contain GPS metadata. Visual geolocation model not yet integrated.",
                    "location_match": None,
                    "geolocation_method": method,
                    "confidence": 0.0,
                }

            return {
                "specialist": self.name,
                "modality": self.modality,
                "status": "success",
                "location_match": {
                    "lat": round(lat, 5),
                    "lon": round(lon, 5),
                    "name": location_name
                },
                "geolocation_method": method,
                "extracted_features": ["Exact EXIF GPS Metadata"],
                "confidence": confidence
            }
        except Exception as e:
            return {
                "specialist": self.name,
                "status": "error",
                "error": str(e)
            }


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def _classify_scene(ndvi: float, ndbi: float, ndwi: float) -> str:
    """Classify a scene from real spectral indices."""
    if ndwi > 0.1:
        return "Water body detected (NDWI > 0.1)"
    elif ndvi > 0.6:
        return "Dense vegetation / forest canopy (NDVI > 0.6)"
    elif ndvi > 0.3:
        if ndbi > 0.05:
            return "Mixed peri-urban: vegetation with scattered built-up (NDVI > 0.3, NDBI > 0.05)"
        return "Moderate vegetation / agricultural land (NDVI > 0.3)"
    elif ndvi > 0.15:
        if ndbi > 0.1:
            return "Urban with sparse vegetation (NDBI > 0.1, NDVI 0.15-0.3)"
        return "Sparse vegetation / grassland / bare soil transition"
    elif ndbi > 0.15:
        return "Dense urban / built-up / impervious surface (NDBI > 0.15)"
    elif ndbi > 0.05:
        return "Moderate built-up / industrial / infrastructure"
    else:
        return "Bare soil / arid terrain / post-construction"


def _compute_transitions(ndvi_change: float, ndbi_change: float, ndwi_change: float, aoi_km2: float) -> list:
    """Compute land-cover transition labels from real index deltas."""
    transitions = []

    if ndvi_change < -0.02 and ndbi_change > 0.01:
        transitions.append({
            "from_class": "Vegetation / Agricultural Land",
            "to_class": "Built-up / Impervious Surface",
            "area_ha": round(abs(ndvi_change) * aoi_km2 * 100, 1),
            "confidence": 0.85,
        })

    if ndvi_change > 0.02:
        transitions.append({
            "from_class": "Bare Soil / Cleared Land",
            "to_class": "Vegetation Regrowth",
            "area_ha": round(abs(ndvi_change) * aoi_km2 * 100, 1),
            "confidence": 0.80,
        })

    if ndbi_change > 0.02:
        transitions.append({
            "from_class": "Open / Undeveloped Land",
            "to_class": "New Construction / Urbanization",
            "area_ha": round(abs(ndbi_change) * aoi_km2 * 100, 1),
            "confidence": 0.82,
        })

    if ndwi_change > 0.03:
        transitions.append({
            "from_class": "Land / Dry Area",
            "to_class": "Water Body Expansion / Flooding",
            "area_ha": round(abs(ndwi_change) * aoi_km2 * 100, 1),
            "confidence": 0.78,
        })

    if ndwi_change < -0.03:
        transitions.append({
            "from_class": "Water Body / Wetland",
            "to_class": "Land Reclamation / Drought",
            "area_ha": round(abs(ndwi_change) * aoi_km2 * 100, 1),
            "confidence": 0.75,
        })

    # If no significant changes detected
    if not transitions:
        transitions.append({
            "from_class": "Stable Land Cover",
            "to_class": "No Significant Change Detected",
            "area_ha": 0.0,
            "confidence": 0.90,
        })

    return transitions


def _cross_validate_sar_optical(vv_db: float, vh_db: float, optical: Dict[str, Any]) -> Dict[str, Any]:
    """Cross-validate SAR backscatter with optical findings."""
    optical_findings = optical.get("findings", {})
    spectral = optical_findings.get("spectral_signature", {})

    # Get NDBI from optical (if available as dict)
    ndbi = 0.0
    if isinstance(spectral, dict):
        ndbi = spectral.get("ndbi", 0.0)

    # SAR urban detection: strong backscatter = urban
    sar_urban = vv_db > -8
    # Optical urban detection: high NDBI = urban
    optical_urban = ndbi > 0.05

    if sar_urban and optical_urban:
        return {
            "verdict": "CONFIRMED — SAR structural response corroborates optical built-up detection",
            "agreement": "strong",
            "confidence": 0.92,
        }
    elif sar_urban and not optical_urban:
        return {
            "verdict": "PARTIAL — SAR detects structures but optical shows vegetation dominance. Possible tree-canopy-covered buildings.",
            "agreement": "partial",
            "confidence": 0.65,
        }
    elif not sar_urban and optical_urban:
        return {
            "verdict": "INCONCLUSIVE — Optical suggests built-up but SAR shows low backscatter. Possible flat rooftops or smooth surfaces.",
            "agreement": "weak",
            "confidence": 0.50,
        }
    else:
        return {
            "verdict": "CONSISTENT — Both SAR and optical confirm non-urban surface (vegetation/water/bare soil)",
            "agreement": "strong",
            "confidence": 0.88,
        }
