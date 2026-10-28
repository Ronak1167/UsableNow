@echo off
echo ========================================================
echo Starting UsableNow - Open Doesn't Mean Usable
echo Lumina '26 Hackathon - Team 404 Brain Not Found
echo ========================================================

echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "UsableNow Backend" cmd /k "cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo Starting Vite Frontend on port 5173 (localhost and LAN) ...
start "UsableNow Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are launching!
echo Frontend on this laptop: http://localhost:5173
echo On a phone on the same Wi-Fi, open http://YOUR-LAPTOP-IP:5173
echo Find the laptop IP with ipconfig (IPv4 Address).
echo Backend API: http://127.0.0.1:8000
echo API Docs: http://127.0.0.1:8000/docs
echo ========================================================
pause
