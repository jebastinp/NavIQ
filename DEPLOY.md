# Deploying NavIQ for free

NavIQ has three parts. Here's where each one goes — all free:

| Part      | Host       | Free tier                                    |
|-----------|------------|----------------------------------------------|
| Database  | Supabase   | 500 MB storage, 50k monthly active users     |
| Backend   | Render     | 750 hrs/month, sleeps after 15 min idle      |
| Frontend  | Vercel     | 100 GB bandwidth, unlimited static requests  |

> **Heads-up about Render's free tier:** the backend sleeps after 15 minutes of no traffic. The first request after sleep takes ~30 seconds to wake up. After that it's fast again. For demos and small use this is fine. To remove sleep, upgrade Render to the $7/mo plan.

---

## Step 1 — Push your code to GitHub

You need a GitHub account. If you don't have one, sign up at https://github.com.

1. Create a new **empty** repository at https://github.com/new
   - Name it: `naviq` (or anything you want)
   - Set to **Private** (recommended — your keys are in `.env`)
   - **Don't** add a README, .gitignore, or license (we already have them)

2. In your local NavIQ folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial NavIQ commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/naviq.git
   git push -u origin main
   ```

3. **Important — verify your `.env` files were NOT pushed.** Visit your repo on GitHub. You should see `backend/.env.example` and `frontend/.env.example`, but **NOT** `backend/.env` or `frontend/.env.local`. The `.gitignore` should have excluded them. If you see them, delete them from GitHub immediately — they contain your secrets.

---

## Step 2 — Set up Supabase (you've likely already done this)

If you haven't yet:
1. Go to https://supabase.com and create a free project
2. SQL Editor → paste contents of `supabase/schema.sql` → Run
3. Authentication → Providers → Email → toggle **"Confirm email"** OFF
4. Project Settings → API → copy these (you'll need them in the next steps):
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_KEY`
5. Project Settings → API → JWT Settings → JWT Secret → `SUPABASE_JWT_SECRET`

---

## Step 3 — Deploy the backend to Render

1. Sign up at https://render.com (free, can use GitHub login)
2. Click **New** → **Web Service** → connect your `naviq` GitHub repo
3. Fill in:
   - **Name:** `naviq-backend`
   - **Region:** pick the one closest to you
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** **Free**
4. Scroll down to **Environment Variables** and add these (one at a time):
   - `SUPABASE_URL` → from Supabase
   - `SUPABASE_ANON_KEY` → from Supabase
   - `SUPABASE_SERVICE_KEY` → from Supabase
   - `SUPABASE_JWT_SECRET` → from Supabase
   - `ORS_API_KEY` → from https://openrouteservice.org/dev/
   - `ALLOWED_ORIGINS` → leave empty for now (we'll set it after Vercel deploy)
5. Click **Create Web Service**. First build takes ~5 minutes.
6. When the deploy log shows `🚀 NavIQ backend up`, copy your Render URL. It looks like:
   ```
   https://naviq-backend.onrender.com
   ```
   Save this — you'll need it in the next step.

7. **Test it:** open `https://naviq-backend.onrender.com/health` in your browser. You should see `{"status":"ok",...}`.

---

## Step 4 — Deploy the frontend to Vercel

1. Sign up at https://vercel.com (free, can use GitHub login)
2. Click **Add New** → **Project** → import your `naviq` GitHub repo
3. Fill in:
   - **Framework Preset:** Next.js (should auto-detect)
   - **Root Directory:** click **Edit** → set to `frontend`
   - Leave Build/Output/Install commands as defaults
4. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → from Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → from Supabase
   - `NEXT_PUBLIC_API_URL` → your Render URL from Step 3 (e.g. `https://naviq-backend.onrender.com`)
5. Click **Deploy**. First build takes ~3 minutes.
6. When done, Vercel shows your URL. It looks like:
   ```
   https://naviq.vercel.app
   ```
   Save it.

---

## Step 5 — Connect the two: update CORS

The backend currently rejects requests from your Vercel URL because it's not in the allowed list. Fix this:

1. Render dashboard → your `naviq-backend` service → **Environment** tab
2. Edit `ALLOWED_ORIGINS` and set it to:
   ```
   https://naviq.vercel.app
   ```
   (Replace with your actual Vercel URL.)
3. Click **Save Changes**. Render auto-redeploys (~1 min).

---

## Step 6 — Test

Open `https://naviq.vercel.app` and try to sign up + log in + add a driver + optimize a route. If anything fails:

- **"Sign in failed"** → check your Supabase env vars on Vercel
- **"API 401"** → check `SUPABASE_JWT_SECRET` on Render
- **"Network error" / CORS** → check `ALLOWED_ORIGINS` on Render exactly matches your Vercel URL (https, no trailing slash)
- **First request takes 30 sec** → that's Render's free tier waking up. Subsequent requests are fast.

---

## Updating later

Whenever you change code locally:
```bash
git add .
git commit -m "Your message"
git push
```

Both Render and Vercel auto-deploy from `main` on every push. No manual redeploy needed.

---

## Custom domain (optional, also free)

Both Vercel and Render let you attach a custom domain at no cost. Buy a domain anywhere (Namecheap, Cloudflare, Porkbun) and follow their UI prompts under "Domains" settings. Update `ALLOWED_ORIGINS` on Render and `NEXT_PUBLIC_API_URL` on Vercel afterwards.
