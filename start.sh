#!/bin/bash
# ============================================================
# NavIQ — One-command launcher
# Sets up everything on first run, then starts both servers.
# ============================================================

set -e

# Colors
B='\033[1;34m'  # blue (backend)
G='\033[1;32m'  # green (frontend)
Y='\033[1;33m'  # yellow (info)
R='\033[1;31m'  # red (error)
N='\033[0m'     # reset

cd "$(dirname "$0")"

echo -e "${Y}=========================================${N}"
echo -e "${Y}  NavIQ — Starting${N}"
echo -e "${Y}=========================================${N}"
echo ""

# ---------- Check Python ----------
if ! command -v python3 &> /dev/null; then
  echo -e "${R}ERROR: python3 not found. Install Python 3.10+ from python.org${N}"
  exit 1
fi
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "${Y}✓ Python ${PYTHON_VERSION} found${N}"

# ---------- Check Node ----------
if ! command -v node &> /dev/null; then
  echo -e "${R}ERROR: node not found. Install Node.js 18+ from nodejs.org${N}"
  exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${Y}✓ Node ${NODE_VERSION} found${N}"
echo ""

# ---------- Backend setup (first run only) ----------
if [ ! -d backend/venv ]; then
  echo -e "${B}[SETUP] Creating Python virtual environment…${N}"
  cd backend
  python3 -m venv venv
  source venv/bin/activate
  echo -e "${B}[SETUP] Installing Python packages (this takes 1–2 minutes)…${N}"
  pip install --quiet --upgrade pip
  pip install --quiet -r requirements.txt
  deactivate
  cd ..
  echo -e "${B}[SETUP] Backend ready${N}"
  echo ""
fi

# ---------- Frontend setup (first run only) ----------
if [ ! -d frontend/node_modules ]; then
  echo -e "${G}[SETUP] Installing Node packages (this takes 1–2 minutes)…${N}"
  cd frontend
  npm install --silent
  cd ..
  echo -e "${G}[SETUP] Frontend ready${N}"
  echo ""
fi

# ---------- Start both servers ----------
echo -e "${Y}=========================================${N}"
echo -e "${Y}  Starting both servers…${N}"
echo -e "${Y}=========================================${N}"
echo -e "${B}  Backend:  http://localhost:8000${N}"
echo -e "${G}  Frontend: http://localhost:3000${N}"
echo -e "${Y}  Diagnostic page: http://localhost:3000/diagnostic${N}"
echo ""
echo -e "${Y}Press Ctrl+C to stop both servers.${N}"
echo ""

# Kill all child processes on exit
trap 'echo ""; echo -e "${Y}Stopping servers…${N}"; kill 0 2>/dev/null; exit 0' EXIT INT TERM

# Backend
(
  cd backend
  source venv/bin/activate
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | sed "s/^/$(printf "${B}[BACKEND]${N}  ")/"
) &

# Frontend
(
  cd frontend
  npm run dev 2>&1 | sed "s/^/$(printf "${G}[FRONTEND]${N} ")/"
) &

wait
