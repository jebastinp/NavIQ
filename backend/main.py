"""NavIQ — FastAPI Backend"""
import os
import time
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from optimizer import optimize_routes, OptimizeRequest, OptimizeResponse, HAS_ORTOOLS
from geocode import geocode_address, GeocodeResult
from db import verify_user_jwt

load_dotenv()
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 NavIQ backend up")
    print(f"   CORS: {ALLOWED_ORIGINS}")
    print(f"   Supabase: {(os.getenv('SUPABASE_URL') or 'not set')[:50]}")
    print(f"   ORS: {'set' if os.getenv('ORS_API_KEY') else 'NOT SET'}")
    print(f"   OR-Tools: {'installed' if HAS_ORTOOLS else 'fallback heuristic'}")
    yield


app = FastAPI(title="NavIQ", version="4.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        print("[auth] No Authorization header sent by client")
        raise HTTPException(401, "Missing Authorization header")
    if not authorization.startswith("Bearer "):
        print(f"[auth] Bad header format: {authorization[:30]}...")
        raise HTTPException(401, "Authorization header must start with 'Bearer '")
    token = authorization.replace("Bearer ", "").strip()
    print(f"[auth] Got token (first 30 chars): {token[:30]}... (len={len(token)})")
    user = verify_user_jwt(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token — see backend logs")
    print(f"[auth] ✓ User verified: sub={user.get('sub','?')[:8]} role={user.get('role','?')}")
    return user


@app.get("/auth-debug")
async def auth_debug(authorization: Optional[str] = Header(None)):
    """Test endpoint to debug auth issues. Returns details of what was received."""
    import os
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    info = {
        "has_authorization_header": bool(authorization),
        "header_starts_with_bearer": bool(authorization and authorization.startswith("Bearer ")),
        "jwt_secret_configured": bool(secret),
        "jwt_secret_length": len(secret) if secret else 0,
        "jwt_secret_first_chars": secret[:8] + "..." if secret else None,
    }
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        info["token_length"] = len(token)
        info["token_first_chars"] = token[:30] + "..."
        # Try to decode without verification first to see structure
        try:
            import jwt as pyjwt
            unverified = pyjwt.decode(token, options={"verify_signature": False})
            info["token_payload_unverified"] = {
                "sub": unverified.get("sub", "")[:12] + "...",
                "role": unverified.get("role"),
                "aud": unverified.get("aud"),
                "iss": unverified.get("iss"),
                "exp": unverified.get("exp"),
            }
        except Exception as e:
            info["unverified_decode_error"] = str(e)

        # Now try real verification
        user = verify_user_jwt(token)
        info["verification_result"] = "SUCCESS" if user else "FAILED — see backend console for details"
    return info


@app.get("/")
def root():
    return {"service": "NavIQ", "version": "4.0.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok", "ortools": HAS_ORTOOLS,
            "ors_configured": bool(os.getenv("ORS_API_KEY")),
            "supabase_configured": bool(os.getenv("SUPABASE_URL"))}


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize(req: OptimizeRequest, user: dict = Depends(current_user)):
    t0 = time.time()
    if not req.orders or not req.drivers:
        raise HTTPException(400, "Need at least 1 order and 1 driver")
    result = optimize_routes(req)
    result.optimization_time_ms = round((time.time() - t0) * 1000, 1)
    return result


class GeocodeOne(BaseModel):
    address: str = Field(..., min_length=2)
    postcode: Optional[str] = None
    country: str = "GB"


class GeocodeBatchIn(BaseModel):
    items: List[GeocodeOne]


@app.post("/geocode", response_model=GeocodeResult)
async def geocode_one(req: GeocodeOne, user: dict = Depends(current_user)):
    r = await geocode_address(req.address, req.postcode, req.country)
    if not r:
        raise HTTPException(404, "Could not geocode")
    return r


@app.post("/geocode/batch")
async def geocode_batch(req: GeocodeBatchIn, user: dict = Depends(current_user)):
    out = []
    for item in req.items:
        try:
            r = await geocode_address(item.address, item.postcode, item.country)
            out.append({"input": item.dict(), "result": r.dict() if r else None, "error": None})
        except Exception as e:
            out.append({"input": item.dict(), "result": None, "error": str(e)})
    return {"results": out, "count": len(out)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
