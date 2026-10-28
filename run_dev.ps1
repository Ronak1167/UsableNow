# UsableNow Dev Server Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting UsableNow - Open Doesn't Mean Usable" -ForegroundColor Cyan
Write-Host "Lumina '26 Hackathon - Team 404 Brain Not Found" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "Backend: http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/docs)" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
