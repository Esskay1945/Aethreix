"""
ORBITAL Location Engine — Comprehensive Natural Language Resolver

Resolves:
- Raw decimal coordinates (lat, lon)
- DMS coordinates (e.g., 19°18'N 73°12'E)
- Plus Codes (e.g., 7JVW9XPG+GQ)
- Natural language place names with hierarchy parsing
  (Country → State → District → City → Landmark)
- Spatial relationship queries ("near the river", "industrial area")
"""

import requests
import re
from typing import Dict, Any, Optional, List


# ── Coordinate Format Parsers ──

def _parse_decimal(query: str) -> Optional[Dict[str, Any]]:
    """Parse raw decimal coordinates: 19.3, 73.209"""
    coord_match = re.match(r'^[-+]?\d+\.?\d*\s*,\s*[-+]?\d+\.?\d*$', query.strip())
    if coord_match:
        parts = query.split(',')
        lat = float(parts[0].strip())
        lon = float(parts[1].strip())
        return {
            "lat": lat,
            "lon": lon,
            "name": f"{lat:.4f}, {lon:.4f}",
            "type": "coordinate",
            "parse_method": "decimal",
        }
    return None


def _parse_dms(query: str) -> Optional[Dict[str, Any]]:
    """Parse DMS coordinates: 19°18'0"N 73°12'30"E or 19 18 0 N 73 12 30 E"""
    dms_pattern = re.compile(
        r"(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d{1,2}(?:\.\d+)?)[\"″\s]*([NSns])\s*"
        r"(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d{1,2}(?:\.\d+)?)[\"″\s]*([EWew])",
        re.IGNORECASE
    )
    match = dms_pattern.search(query)
    if match:
        lat_d, lat_m, lat_s, lat_ref = int(match.group(1)), int(match.group(2)), float(match.group(3)), match.group(4).upper()
        lon_d, lon_m, lon_s, lon_ref = int(match.group(5)), int(match.group(6)), float(match.group(7)), match.group(8).upper()

        lat = lat_d + lat_m / 60.0 + lat_s / 3600.0
        lon = lon_d + lon_m / 60.0 + lon_s / 3600.0
        if lat_ref == 'S':
            lat = -lat
        if lon_ref == 'W':
            lon = -lon

        return {
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "name": f"{lat:.4f}°N, {lon:.4f}°E",
            "type": "coordinate",
            "parse_method": "dms",
        }
    return None


def _parse_plus_code(query: str) -> Optional[Dict[str, Any]]:
    """Detect Plus Codes (Open Location Codes)."""
    plus_code_pattern = re.compile(r'^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$', re.IGNORECASE)
    if plus_code_pattern.match(query.strip()):
        # Resolve Plus Code via Google's geocoding or a lookup
        try:
            url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(query.strip())}&limit=1"
            response = requests.get(url, headers={'User-Agent': 'ORBITAL-GEOINT/2.0'}, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data:
                    return {
                        "lat": float(data[0]["lat"]),
                        "lon": float(data[0]["lon"]),
                        "name": data[0].get("display_name", query),
                        "type": "plus_code",
                        "parse_method": "plus_code",
                    }
        except Exception:
            pass
    return None


# ── Hierarchical NLP Location Parser ──

def _extract_spatial_context(query: str) -> Dict[str, Any]:
    """
    Extracts spatial relationship hints from natural language.
    Returns contextual tags for enriching the geocoding query.
    """
    q = query.lower()

    context = {
        "relationships": [],
        "place_types": [],
    }

    # Spatial relationships
    relationship_patterns = {
        "near": ["near", "close to", "next to", "beside", "adjacent to", "around"],
        "in": ["in", "inside", "within", "at"],
        "along": ["along", "on the bank of", "by the", "riverside"],
        "between": ["between"],
    }
    for rel_type, keywords in relationship_patterns.items():
        for kw in keywords:
            if kw in q:
                context["relationships"].append(rel_type)
                break

    # Place type hints
    place_types = {
        "river": ["river", "nadi", "ganga", "yamuna", "godavari", "krishna"],
        "lake": ["lake", "tal", "jheel", "pond"],
        "airport": ["airport", "aerodrome", "airstrip"],
        "railway": ["railway", "station", "junction", "terminal"],
        "university": ["university", "college", "iit", "nit", "iisc", "campus"],
        "industrial": ["industrial", "factory", "refinery", "sez", "manufacturing"],
        "hospital": ["hospital", "medical", "clinic", "aiims"],
        "park": ["park", "garden", "national park", "wildlife", "sanctuary"],
        "port": ["port", "harbor", "harbour", "dock", "jetty"],
        "dam": ["dam", "barrage", "reservoir"],
        "highway": ["highway", "expressway", "national highway", "nh"],
    }
    for ptype, keywords in place_types.items():
        for kw in keywords:
            if kw in q:
                context["place_types"].append(ptype)
                break

    return context


def _geocode_nominatim(query: str, limit: int = 3) -> List[Dict[str, Any]]:
    """Query Nominatim for geocoding results. Returns ranked candidates."""
    try:
        url = (
            f"https://nominatim.openstreetmap.org/search?"
            f"format=json&q={requests.utils.quote(query)}&limit={limit}"
            f"&addressdetails=1&extratags=1"
        )
        response = requests.get(url, headers={'User-Agent': 'ORBITAL-GEOINT/2.0'}, timeout=8)

        if response.status_code == 200:
            data = response.json()
            results = []
            for item in data:
                address = item.get("address", {})
                name_parts = item.get('display_name', '').split(',')
                short_name = ','.join(name_parts[:2]).strip() if name_parts else query

                results.append({
                    "lat": float(item["lat"]),
                    "lon": float(item["lon"]),
                    "name": short_name,
                    "display_name": item.get("display_name"),
                    "type": item.get("type", "location"),
                    "class": item.get("class", "place"),
                    "importance": item.get("importance", 0),
                    "hierarchy": {
                        "country": address.get("country"),
                        "state": address.get("state"),
                        "district": address.get("county") or address.get("state_district"),
                        "city": address.get("city") or address.get("town") or address.get("village"),
                        "suburb": address.get("suburb") or address.get("neighbourhood"),
                        "road": address.get("road"),
                    },
                    "bounding_box": item.get("boundingbox"),
                })
            return results
    except Exception as e:
        print(f"Geocoding error: {e}")

    return []


def resolve_location(query: str) -> Optional[Dict[str, Any]]:
    """
    Resolves a natural language query, DMS coordinates, Plus Codes, or
    decimal coordinates into a structured location object.

    Supports:
    - Raw decimal coordinates
    - DMS coordinates
    - Plus Codes
    - Natural language with hierarchy parsing
    - Spatial relationships ("near the river in Pune")
    """
    query = query.strip()
    if not query:
        return None

    # ── Try coordinate parsers first ──
    result = _parse_decimal(query)
    if result:
        return result

    result = _parse_dms(query)
    if result:
        return result

    result = _parse_plus_code(query)
    if result:
        return result

    # ── Extract spatial context from NLP ──
    spatial_context = _extract_spatial_context(query)

    # ── Geocode via Nominatim with multiple candidates ──
    candidates = _geocode_nominatim(query, limit=3)

    if not candidates:
        return None

    # Rank candidates by importance score
    best = max(candidates, key=lambda c: c.get("importance", 0))

    # Enrich with spatial context
    best["spatial_context"] = spatial_context
    best["parse_method"] = "nominatim_nlp"
    best["candidate_count"] = len(candidates)

    return best


def reverse_geocode(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """
    Reverse geocodes a coordinate pair into a structured location
    with full administrative hierarchy.
    """
    try:
        url = (
            f"https://nominatim.openstreetmap.org/reverse?"
            f"format=json&lat={lat}&lon={lon}&zoom=14&addressdetails=1"
        )
        response = requests.get(url, headers={'User-Agent': 'ORBITAL-GEOINT/2.0'}, timeout=5)

        if response.status_code == 200:
            data = response.json()
            if data and not data.get('error'):
                address = data.get("address", {})
                data["hierarchy"] = {
                    "country": address.get("country"),
                    "state": address.get("state"),
                    "district": address.get("county") or address.get("state_district"),
                    "city": address.get("city") or address.get("town") or address.get("village"),
                    "suburb": address.get("suburb") or address.get("neighbourhood"),
                    "road": address.get("road"),
                }
                return data
    except Exception as e:
        print(f"Reverse geocoding error: {e}")

    return None
