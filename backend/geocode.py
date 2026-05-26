"""Geocoding via OpenRouteService Pelias."""
import os
import httpx
from pydantic import BaseModel
from typing import Optional


class GeocodeResult(BaseModel):
    lat: float
    lng: float
    label: str
    confidence: float = 0.0


async def geocode_address(address: str, postcode: Optional[str] = None, country: str = "GB") -> Optional[GeocodeResult]:
    api_key = os.getenv("ORS_API_KEY")
    if not api_key:
        return None
    query = f"{address}, {postcode}" if postcode else address
    params = {
        "api_key": api_key,
        "text": query,
        "boundary.country": country,
        "size": 1,
    }
    url = "https://api.openrouteservice.org/geocode/search"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        if not data.get("features"):
            return None
        feat = data["features"][0]
        coords = feat["geometry"]["coordinates"]  # [lng, lat]
        props = feat.get("properties", {})
        return GeocodeResult(
            lat=coords[1], lng=coords[0],
            label=props.get("label", query),
            confidence=props.get("confidence", 0.0),
        )
    except Exception as e:
        print(f"Geocode error for '{query}': {e}")
        return None
