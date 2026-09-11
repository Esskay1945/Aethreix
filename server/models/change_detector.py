"""
ORBITAL Change Detection Inference Model
Executes bi-temporal pixel change detection, spectral index differencing, and vector polygon generation.

IMPORTANT: This model now honestly reports whether its input data was real multispectral
or RGB-only proxy data. Land-cover transition ratios are COMPUTED from pixel data,
not hard-coded.
"""

import numpy as np
from typing import Dict, Any
from server.data.stac_pipeline import fetch_tile_spectral_matrix
from server.data.spectral_math import (
    compute_ndvi,
    compute_ndbi_proxy,
    compute_water_index,
    otsu_threshold,
    generate_change_mask_polygons
)


def run_bitemporal_change_detection(
    lat: float,
    lon: float,
    year_a: int,
    year_b: int,
    radius_km: float = 3.0
) -> Dict[str, Any]:
    """
    Executes bi-temporal change detection between Year A and Year B at [lat, lon].
    Returns detailed metrics, transition breakdown, and GeoJSON change polygons.
    
    Honestly reports whether analysis used real multispectral data or RGB proxy.
    """
    if year_a > year_b:
        year_a, year_b = year_b, year_a

    # Fetch spectral matrices for both years
    data_a = fetch_tile_spectral_matrix(lat, lon, year_a, grid_size=36)
    data_b = fetch_tile_spectral_matrix(lat, lon, year_b, grid_size=36)

    # Check data availability
    if data_a["status"] == "unavailable" or data_b["status"] == "unavailable":
        return {
            "status": "data_unavailable",
            "data_status": "unavailable",
            "parameters": {
                "latitude": lat,
                "longitude": lon,
                "year_baseline": year_a,
                "year_target": year_b,
            },
            "quantitative_results": {},
            "land_cover_transitions": [],
            "geojson_change_mask": {"type": "FeatureCollection", "features": []},
            "error": "Could not retrieve satellite imagery tiles for one or both dates.",
        }

    # Determine data quality
    has_real_nir = data_a.get("nir") is not None and data_b.get("nir") is not None
    data_status = "real_multispectral" if has_real_nir else "rgb_proxy"

    # Compute indices — adapt based on available bands
    if has_real_nir:
        ndvi_a = compute_ndvi(data_a["nir"], data_a["red"])
        ndvi_b = compute_ndvi(data_b["nir"], data_b["red"])
    else:
        # RGB-only: use green/red ratio as a vegetation proxy (NOT real NDVI)
        ndvi_a = compute_ndvi(data_a["green"].astype(float) * 1.2, data_a["red"])
        ndvi_b = compute_ndvi(data_b["green"].astype(float) * 1.2, data_b["red"])

    ndbi_a = compute_ndbi_proxy(data_a["red"], data_a["green"], data_a["blue"])
    ndbi_b = compute_ndbi_proxy(data_b["red"], data_b["green"], data_b["blue"])
    ndwi_a = compute_water_index(data_a["green"], data_a["red"], data_a["blue"])
    ndwi_b = compute_water_index(data_b["green"], data_b["red"], data_b["blue"])

    # Spectral Deltas
    delta_ndbi = ndbi_b - ndbi_a
    delta_ndvi = ndvi_a - ndvi_b
    delta_ndwi = np.abs(ndwi_b - ndwi_a)

    # Change Vector Magnitude (CVA)
    change_magnitude = np.sqrt(
        (np.maximum(0, delta_ndbi) * 1.5) ** 2 +
        (np.maximum(0, delta_ndvi) * 1.2) ** 2 +
        (delta_ndwi * 0.8) ** 2
    )
    change_magnitude = np.clip(change_magnitude, 0.0, 1.0)

    # Optimal Otsu thresholding
    threshold = otsu_threshold(change_magnitude)

    # Generate real GeoJSON polygon features
    geojson_mask, changed_area_sq_km, change_pct = generate_change_mask_polygons(
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        diff_grid=change_magnitude,
        threshold=threshold,
        grid_res=36
    )

    # COMPUTE actual transition ratios from pixel data (not hard-coded)
    total_area_sq_km = (2 * radius_km) ** 2
    changed_mask = change_magnitude > threshold
    total_changed_pixels = int(np.sum(changed_mask))

    if total_changed_pixels > 0:
        # Classify changed pixels by dominant spectral shift
        veg_to_built = np.sum((delta_ndvi > 0.1) & (delta_ndbi > 0.05) & changed_mask)
        veg_loss = np.sum((delta_ndvi > 0.1) & (delta_ndbi <= 0.05) & changed_mask)
        water_change = np.sum((np.abs(delta_ndwi) > 0.15) & changed_mask)
        other_change = total_changed_pixels - veg_to_built - veg_loss - water_change

        builtup_ratio = float(veg_to_built) / total_changed_pixels
        veg_loss_ratio = float(veg_loss) / total_changed_pixels
        water_ratio = float(water_change) / total_changed_pixels
        other_ratio = float(max(0, other_change)) / total_changed_pixels
    else:
        builtup_ratio = 0.0
        veg_loss_ratio = 0.0
        water_ratio = 0.0
        other_ratio = 0.0

    builtup_increase_ha = round(changed_area_sq_km * builtup_ratio * 100, 1)
    veg_loss_ha = round(changed_area_sq_km * veg_loss_ratio * 100, 1)
    water_change_ha = round(changed_area_sq_km * water_ratio * 100, 1)

    transitions = []
    if builtup_ratio > 0.01:
        transitions.append({
            "from_class": "Vegetation / Agricultural Land",
            "to_class": "Built-up / Impervious Surface",
            "area_ha": builtup_increase_ha,
            "percentage_of_change": round(builtup_ratio * 100, 1)
        })
    if veg_loss_ratio > 0.01:
        transitions.append({
            "from_class": "Vegetation / Green Cover",
            "to_class": "Bare Soil / Cleared Land",
            "area_ha": veg_loss_ha,
            "percentage_of_change": round(veg_loss_ratio * 100, 1)
        })
    if water_ratio > 0.01:
        transitions.append({
            "from_class": "Land / Water Edge",
            "to_class": "Modified Water Body",
            "area_ha": water_change_ha,
            "percentage_of_change": round(water_ratio * 100, 1)
        })
    if other_ratio > 0.01:
        transitions.append({
            "from_class": "Other Land Cover",
            "to_class": "Changed Land Cover",
            "area_ha": round(changed_area_sq_km * other_ratio * 100, 1),
            "percentage_of_change": round(other_ratio * 100, 1)
        })

    return {
        "status": "success",
        "data_status": data_status,
        "parameters": {
            "latitude": lat,
            "longitude": lon,
            "year_baseline": year_a,
            "year_target": year_b,
            "temporal_span_years": year_b - year_a,
            "inspection_radius_km": radius_km,
            "total_analyzed_area_sq_km": round(total_area_sq_km, 1)
        },
        "quantitative_results": {
            "total_changed_area_sq_km": changed_area_sq_km,
            "total_change_percentage": change_pct,
            "built_up_expansion_ha": builtup_increase_ha,
            "vegetation_loss_ha": veg_loss_ha,
            "water_body_delta_ha": water_change_ha,
            "otsu_spectral_threshold": round(threshold, 3),
            "mean_ndvi_baseline": round(float(np.mean(ndvi_a)), 3),
            "mean_ndvi_target": round(float(np.mean(ndvi_b)), 3),
            "mean_ndbi_baseline": round(float(np.mean(ndbi_a)), 3),
            "mean_ndbi_target": round(float(np.mean(ndbi_b)), 3),
        },
        "data_quality_warning": (
            "Analysis used RGB proxy data (not real multispectral bands). "
            "NDVI values are approximations. Real analysis requires Earth Engine integration."
        ) if data_status == "rgb_proxy" else None,
        "land_cover_transitions": transitions,
        "geojson_change_mask": geojson_mask,
        "spectral_sources": [
            f"{data_a.get('data_source', 'Unknown')} ({year_a})",
            f"{data_b.get('data_source', 'Unknown')} ({year_b})"
        ]
    }
