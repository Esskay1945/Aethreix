"""
ORBITAL STAC & Earth Observation Data Pipeline
Fetches Copernicus Sentinel-2 optical scene metadata and imagery tiles.

IMPORTANT: No fake NIR synthesis. No simulated fallback data.
If real data is unavailable, the system reports it honestly.
"""

import requests
import numpy as np
from typing import Dict, Any, List
from datetime import datetime
import io
from PIL import Image

COPERNICUS_STAC_URL = "https://catalogue.dataspace.copernicus.eu/stac/search"
PLANETARY_COMPUTER_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"


def query_stac_scenes(
    lat: float,
    lon: float,
    start_year: int,
    end_year: int,
    max_cloud_cover: float = 20.0
) -> List[Dict[str, Any]]:
    """
    Queries STAC API for Sentinel-2 L2A scenes around coordinates across the given year range.
    Returns real results or an empty list — never synthesizes fake catalog entries.
    """
    delta = 0.05
    bbox = [lon - delta, lat - delta, lon + delta, lat + delta]
    start_date = f"{start_year}-01-01T00:00:00Z"
    end_date = f"{end_year}-12-31T23:59:59Z"

    headers = {"User-Agent": "ORBITAL-GEOINT-Engine/2.0", "Content-Type": "application/json"}
    payload = {
        "collections": ["SENTINEL-2"],
        "bbox": bbox,
        "datetime": f"{start_date}/{end_date}",
        "query": {"cloudCover": {"lte": max_cloud_cover}},
        "limit": 10
    }

    results = []
    try:
        resp = requests.post(COPERNICUS_STAC_URL, json=payload, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            for f in features:
                props = f.get("properties", {})
                results.append({
                    "id": f.get("id"),
                    "platform": props.get("platform", "Sentinel-2"),
                    "datetime": props.get("datetime", ""),
                    "cloud_cover": props.get("cloudCover", 0.0),
                    "bbox": f.get("bbox", bbox),
                    "source": "Copernicus Data Space"
                })
    except Exception as e:
        # STAC unavailable — return empty, NOT fake data
        pass

    return results  # May be empty — that's honest


def fetch_tile_spectral_matrix(
    lat: float,
    lon: float,
    year: int,
    grid_size: int = 32
) -> Dict[str, Any]:
    """
    Fetches real tile image for the coordinate and year, extracts RGB channels.
    
    NOTE: This provides RGB from rendered satellite mosaics (e.g., EOX Sentinel-2 cloudless).
    These are true-color composites, but they do NOT contain real multispectral bands.
    Real multispectral analysis requires Earth Engine integration.
    
    IMPORTANT: No fake NIR synthesis. The 'nir' channel is OMITTED when we don't have
    real NIR data. Any analysis using NIR must check for this.
    """
    # Calculate Web Mercator tile coordinates at zoom 12
    zoom = 12
    n = 2.0 ** zoom
    lat_rad = np.radians(lat)
    xtile = int((lon + 180.0) / 360.0 * n)
    ytile = int((1.0 - np.arcsinh(np.tan(lat_rad)) / np.pi) / 2.0 * n)

    tile_url = None
    if year >= 2017:
        y_clamped = min(max(year, 2017), 2024)
        tile_url = f"https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-{y_clamped}_3857/default/GoogleMapsCompatible/{zoom}/{ytile}/{xtile}.jpg"
    else:
        y_clamped = max(2005, min(2016, year))
        tile_url = f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{y_clamped}-06-20/GoogleMapsCompatible_Level9/8/{int(ytile/16)}/{int(xtile/16)}.jpg"

    try:
        resp = requests.get(tile_url, timeout=4, headers={"User-Agent": "ORBITAL/2.0"})
        if resp.status_code == 200:
            img = Image.open(io.BytesIO(resp.content)).convert('RGB')
            img_resized = img.resize((grid_size, grid_size), Image.Resampling.BILINEAR)
            arr = np.array(img_resized)
            red = arr[:, :, 0]
            green = arr[:, :, 1]
            blue = arr[:, :, 2]

            return {
                "red": red,
                "green": green,
                "blue": blue,
                # NO fake NIR synthesis — if you need NIR, use Earth Engine
                "nir": None,
                "status": "real_rgb",
                "data_source": "EOX Sentinel-2 Cloudless Mosaic" if year >= 2017 else "NASA GIBS MODIS",
                "tile_url": tile_url,
                "warning": "RGB only — no real multispectral bands. NDVI requires Earth Engine integration.",
            }
    except Exception:
        pass

    # Total failure — return honest unavailable status
    return {
        "red": None,
        "green": None,
        "blue": None,
        "nir": None,
        "status": "unavailable",
        "data_source": "none",
        "tile_url": tile_url,
        "warning": "Tile server unreachable. No data available.",
    }
