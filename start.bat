@echo off
REM ============================================================
REM NavIQ - Windows one-command launcher
REM ============================================================
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo =========================================
echo   NavIQ - Starting
echo =========================================
echo.

REM ---------- Check Python ----------
where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: python not found. Install Python 3.10+ from python.org
  echo Make sure "Add Python to PATH" is checked during installation.
  pause
  exit /b 1
)
echo OK Python found

REM ---------- Check Node ----------
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node not found. Install Node.js 18+ from nodejs.org
  pause
  exit /b 1
)
echo OK Node found
echo.

REM ---------- Backend setup ----------
if not exist "backend\venv" (
  echo [SETUP] Creating Python virtual environment...
  cd backend
  python -m venv venv
  call venv\Scripts\activate.bat
  echo [SETUP] Installing Python packages (1-2 minutes)...
  python -m pip install --quiet --upgrade pip
  pip install --quiet -r requirements.txt
  call deactivate
  cd ..
  echo [SETUP] Backend ready
  echo.
)

REM ---------- Frontend setup ----------
if not exist "frontend\node_modules" (
  echo [SETUP] Installing Node packages (1-2 minutes)...
  cd frontend
  call npm install --silent
  cd ..
  echo [SETUP] Frontend ready
  echo.
)

REM ---------- Start both servers in new windows ----------
echo =========================================
echo   Starting both servers...
echo =========================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   Diagnostic: http://localhost:3000/diagnostic
echo.
echo Two new windows will open. Close them to stop the servers.
echo.

start "NavIQ Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

start "NavIQ Frontend" cmd /k "cd frontend && npm run dev"

echo Both servers starting. Wait ~10 seconds, then open:
echo   http://localhost:3000/diagnostic
echo.
pause
