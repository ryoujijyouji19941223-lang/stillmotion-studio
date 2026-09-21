@echo off
cd /d "%~dp0"
start "" http://localhost:4173
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 4173
) else (
  python -m http.server 4173
)
