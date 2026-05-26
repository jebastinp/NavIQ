"""JWT verification with two layers:
1. Fast path: verify locally with SUPABASE_JWT_SECRET (no network call)
2. Fallback: ask Supabase Auth API who this token belongs to (network call, but always works)
"""
import os
import jwt
import httpx
from typing import Optional


# Cache verified tokens in memory for 60 seconds to avoid hammering Supabase
_token_cache: dict = {}


def _verify_locally(token: str) -> Optional[dict]:
    """Try local HMAC verification with the JWT secret."""
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    if not secret:
        return None
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        if not payload.get("sub"):
            return None
        return payload
    except jwt.ExpiredSignatureError:
        print("[auth] Local verify: token expired")
        return None
    except jwt.InvalidSignatureError as e:
        print(f"[auth] Local verify: signature mismatch — JWT_SECRET in .env may be wrong or have a copy-paste error. Will try Supabase API fallback.")
        return None
    except Exception as e:
        print(f"[auth] Local verify failed: {type(e).__name__}: {e}")
        return None


def _verify_via_supabase(token: str) -> Optional[dict]:
    """Ask Supabase's /auth/v1/user endpoint to validate the token."""
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not service_key:
        return None
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(
                f"{url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": service_key,
                },
            )
        if r.status_code == 200:
            data = r.json()
            return {
                "sub": data.get("id"),
                "email": data.get("email"),
                "role": "authenticated",
                "aud": "authenticated",
            }
        else:
            print(f"[auth] Supabase API fallback returned {r.status_code}: {r.text[:200]}")
            return None
    except Exception as e:
        print(f"[auth] Supabase API fallback error: {e}")
        return None


def verify_user_jwt(token: str) -> Optional[dict]:
    """Verify a token via local HMAC first; if that fails, ask Supabase Auth."""
    if not token:
        return None

    # Check tiny in-memory cache (60s)
    import time
    now = time.time()
    cached = _token_cache.get(token)
    if cached and cached["expires"] > now:
        return cached["payload"]

    # Try local first (fast)
    payload = _verify_locally(token)
    if payload:
        _token_cache[token] = {"payload": payload, "expires": now + 60}
        return payload

    # Fallback: ask Supabase (slower but bulletproof)
    print("[auth] Falling back to Supabase API verification…")
    payload = _verify_via_supabase(token)
    if payload:
        _token_cache[token] = {"payload": payload, "expires": now + 60}
        return payload

    return None
