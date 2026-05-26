# NavIQ

AI-powered route optimization with CSV upload, geocoding, VRP solver, per-driver start points, downloadable routes (CSV/JSON/PDF), and live driver tracking.

Designed with Apple's visionOS-style liquid glass — light theme, SF Pro typography, fully responsive on phones / tablets / laptops / desktops.

**Want to host it online for free?** See [DEPLOY.md](DEPLOY.md) — Vercel + Render + Supabase, all free tier.

## 🚀 Run it (one command)

**Mac/Linux:**
```bash
bash start.sh
```

**Windows:**
```cmd
start.bat
```

That's it. The script will:
1. Set up Python venv + install backend packages (first run only, ~2 min)
2. Install Node packages (first run only, ~2 min)
3. Start the backend on port 8000
4. Start the frontend on port 3000

**Then open:** http://localhost:3000/diagnostic

All 5 checks should be green. If any fail, follow the orange arrows.

---

## 📋 Before first run — set up Supabase (3 steps in the web UI)

Your API keys are already baked into `.env` files. You just need to set up the database:

### Step 1 — Wipe any old tables (if you ran an older version)

Go to https://supabase.com/dashboard → your project → SQL Editor → paste this and run:

```sql
DROP TABLE IF EXISTS driver_positions CASCADE;
DROP TABLE IF EXISTS delivery_stops CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS geocode_cache CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
```

### Step 2 — Install the schema

In the same SQL Editor, open `supabase/schema.sql` from this folder, paste the whole file, and run it.

> **Upgrading from an older version?** The new schema adds `start_address`, `start_lat`, `start_lng` columns to the `drivers` table. Running `schema.sql` again is safe — the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements at the bottom will add them without dropping data.

### Step 3 — Turn off email confirmation (for local dev)

Supabase Dashboard → Authentication → Providers → Email → toggle **"Confirm email"** OFF → Save.

---

## ✅ How to use the app

1. Open http://localhost:3000
2. Click **Sign up**, create an account
3. Go to **Drivers** → add at least one driver — give each one a **Start address** (where they begin their route, e.g. their home or your warehouse). It's geocoded automatically on save.
4. Go to **Orders** → either:
   - Click **Load demo** to load 24 sample London addresses, OR
   - Drag-drop your own CSV (columns: `Customer Name`, `Address`, `Phone`)
5. Click **Import X valid** → addresses get geocoded
6. Go to **Routes** → click **Optimize** → see the map (each driver starts from their own start point, marked **S** in their color)
7. Click **Download** → choose CSV (for Excel/Sheets), JSON (for developers), or Printable/PDF (for printing or PDF export via the browser print dialog)
8. Copy a driver's app link from /drivers → open on their phone for the native mobile delivery app
9. Customers receive their own live tracking link (auto-generated per stop)

### What's new in this version

- **Per-driver start points** — Each driver can have their own starting location, not just one shared depot
- **Downloadable routes** — Export as CSV, JSON, or printable/PDF
- **Apple liquid glass design** — visionOS-style heavy translucency, light theme only, fully responsive
- **Mobile-optimized driver app** — Native iOS feel with safe-area insets, large tap targets, Apple Maps integration

---

## 📁 Project structure

```
naviq/
├── start.sh / start.bat       ← Run this
├── README.md                   ← You are here
├── supabase/schema.sql         ← Paste into Supabase SQL Editor
├── backend/                    ← FastAPI + OR-Tools
│   ├── .env                    (your keys, pre-filled)
│   ├── main.py, optimizer.py, geocode.py, db.py
│   └── requirements.txt
└── frontend/                   ← Next.js
    ├── .env.local              (your keys, pre-filled)
    ├── pages/                  (all UI pages)
    ├── components/             (Sidebar, Map, ThemeToggle…)
    ├── lib/                    (Supabase client, hooks)
    └── public/sample-orders.csv  ← Demo data
```

---

## 🌗 Theme

Click the sun/moon icon in the top-right of any page to toggle between light and dark. Your choice is saved in localStorage.

---

## 🛠 Troubleshooting

**"Database error saving new user" on signup:** You didn't run schema.sql yet (or you skipped the GRANT statements). Re-run schema.sql in full.

**Diagnostic page shows red checks:** Follow the orange arrows for each. Common fix: backend not running, or schema not installed.

**Geocoding fails:** ORS free tier = 2000 requests/day. Check status at https://openrouteservice.org/dev/

**"Confirm email" error after signup:** Disable it in Supabase Auth → Providers → Email.

---

## 🔌 Stack

- **Backend:** FastAPI · OR-Tools VRP · OpenRouteService geocoding · PyJWT
- **Frontend:** Next.js 14 (Pages Router) · TypeScript · Tailwind · Leaflet · Supabase JS
- **Database:** Supabase (Postgres + Auth + Realtime)
