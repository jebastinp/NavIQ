-- RouteFlow AI — Simplified Schema
-- Run this ENTIRE file in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  company_name  TEXT,
  depot_lat     NUMERIC(10,7) DEFAULT 51.5095,
  depot_lng     NUMERIC(10,7) DEFAULT -0.1245,
  depot_address TEXT DEFAULT 'Central Depot, Covent Garden, London',
  depot_postcode TEXT DEFAULT 'WC2E 8RF',
  avg_speed_kmh NUMERIC(5,2) DEFAULT 22.0,
  fuel_price_gbp NUMERIC(5,3) DEFAULT 1.480,
  vehicle_kml   NUMERIC(5,2) DEFAULT 9.0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drivers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  vehicle         TEXT,
  capacity        INT NOT NULL DEFAULT 30,
  color           TEXT DEFAULT '#0071e3',
  access_token    TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  current_lat     NUMERIC(10,7),
  current_lng     NUMERIC(10,7),
  last_seen       TIMESTAMPTZ,
  start_address   TEXT,
  start_lat       NUMERIC(10,7),
  start_lng       NUMERIC(10,7),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration: if drivers table existed before, add the new columns
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS start_address TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS start_lat NUMERIC(10,7);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS start_lng NUMERIC(10,7);
CREATE INDEX IF NOT EXISTS drivers_user_idx ON drivers(user_id);
CREATE INDEX IF NOT EXISTS drivers_token_idx ON drivers(access_token);

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name   TEXT NOT NULL,
  address         TEXT NOT NULL,
  phone           TEXT,
  lat             NUMERIC(10,7),
  lng             NUMERIC(10,7),
  geocoded        BOOLEAN DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);

CREATE TABLE IF NOT EXISTS geocode_cache (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query         TEXT NOT NULL UNIQUE,
  lat           NUMERIC(10,7) NOT NULL,
  lng           NUMERIC(10,7) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geocode_query_idx ON geocode_cache(query);

CREATE TABLE IF NOT EXISTS routes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id         UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'planned',
  depot_lat         NUMERIC(10,7) NOT NULL,
  depot_lng         NUMERIC(10,7) NOT NULL,
  distance_km       NUMERIC(8,2),
  duration_minutes  NUMERIC(8,1),
  fuel_saved_gbp    NUMERIC(8,2),
  baseline_km       NUMERIC(8,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routes_user_idx ON routes(user_id);
CREATE INDEX IF NOT EXISTS routes_driver_idx ON routes(driver_id);

CREATE TABLE IF NOT EXISTS delivery_stops (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id      UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sequence      INT NOT NULL,
  eta_clock     TEXT,
  completed_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending',
  customer_token TEXT DEFAULT encode(gen_random_bytes(12), 'hex'),
  UNIQUE(route_id, sequence)
);
CREATE INDEX IF NOT EXISTS stops_route_idx ON delivery_stops(route_id);
CREATE INDEX IF NOT EXISTS stops_token_idx ON delivery_stops(customer_token);

CREATE TABLE IF NOT EXISTS driver_positions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id   UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat         NUMERIC(10,7) NOT NULL,
  lng         NUMERIC(10,7) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS positions_driver_time_idx ON driver_positions(driver_id, recorded_at DESC);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (with proper permissions)
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT INSERT ON public.profiles TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_stops   ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE geocode_cache    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS drivers_own ON drivers;
CREATE POLICY drivers_own ON drivers FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS drivers_public_read ON drivers;
CREATE POLICY drivers_public_read ON drivers FOR SELECT USING (true);

DROP POLICY IF EXISTS drivers_anon_update ON drivers;
CREATE POLICY drivers_anon_update ON drivers FOR UPDATE USING (true);

DROP POLICY IF EXISTS orders_own ON orders;
CREATE POLICY orders_own ON orders FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS orders_public_read ON orders;
CREATE POLICY orders_public_read ON orders FOR SELECT USING (true);

DROP POLICY IF EXISTS routes_own ON routes;
CREATE POLICY routes_own ON routes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS routes_public_read ON routes;
CREATE POLICY routes_public_read ON routes FOR SELECT USING (true);

DROP POLICY IF EXISTS stops_own ON delivery_stops;
CREATE POLICY stops_own ON delivery_stops FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS stops_public_read ON delivery_stops;
CREATE POLICY stops_public_read ON delivery_stops FOR SELECT USING (true);

DROP POLICY IF EXISTS stops_anon_update ON delivery_stops;
CREATE POLICY stops_anon_update ON delivery_stops FOR UPDATE USING (true);

DROP POLICY IF EXISTS positions_own ON driver_positions;
CREATE POLICY positions_own ON driver_positions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS positions_public_read ON driver_positions;
CREATE POLICY positions_public_read ON driver_positions FOR SELECT USING (true);

DROP POLICY IF EXISTS positions_anon_insert ON driver_positions;
CREATE POLICY positions_anon_insert ON driver_positions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS geocode_read ON geocode_cache;
CREATE POLICY geocode_read ON geocode_cache FOR SELECT USING (true);
DROP POLICY IF EXISTS geocode_insert ON geocode_cache;
CREATE POLICY geocode_insert ON geocode_cache FOR INSERT WITH CHECK (true);

-- ============================================================
-- Realtime
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE driver_positions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE delivery_stops;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Done.
