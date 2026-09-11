import requests
import re
from typing import Dict, Any, Optional

def resolve_location(query: str) -> Optional[Dict[str, Any]]:
    """
    Resolves a natural language query, DMS coordinates, or decimal coordinates
    into a structured location object using Nominatim.
    """
    query = query.strip()
    if not query:
        return None

    # Check for raw coordinates (lat, lon)
    coord_match = re.match(r'^[-+]?\d+\.?\d*\s*,\s*[-+]?\d+\.?\d*$', query)
    if coord_match:
        parts = query.split(',')
        lat = float(parts[0].strip())
        lon = float(parts[1].strip())
        return {
            "lat": lat,
            "lon": lon,
            "name": f"{lat:.4f}, {lon:.4f}",
            "type": "coordinate"
        }

    # Use Nominatim for geocoding
    try:
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(query)}&limit=1"
        response = requests.get(url, headers={'User-Agent': 'ORBITAL-GEOINT/2.0'}, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                result = data[0]
                name_parts = result.get('display_name', '').split(',')
                short_name = ','.join(name_parts[:2]).strip() if name_parts else query
                return {
                    "lat": float(result['lat']),
                    "lon": float(result['lon']),
                    "name": short_name,
                    "display_name": result.get('display_name'),
                    "type": result.get('type', 'location')
                }
    except Exception as e:
        print(f"Geocoding error: {e}")
    
    return None

def reverse_geocode(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """
    Reverse geocodes a coordinate pair into a location name.
    """
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=14"
        response = requests.get(url, headers={'User-Agent': 'ORBITAL-GEOINT/2.0'}, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            if data and not data.get('error'):
                return data
    except Exception as e:
        print(f"Reverse geocoding error: {e}")
        
    return None
