@echo off
REM EVLab 3D Studio - double-click to start. Opens the Studio in your browser.
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo Python was not found. Install Python from https://www.python.org/downloads/
    echo Tick "Add Python to PATH" in the installer, then run this file again.
    pause
    exit /b 1
  )
  set PY=py
) else (
  set PY=python
)
echo Starting EVLab 3D Studio at http://localhost:8000/app/index.html
echo Keep this window open while you use the Studio. Close it to stop.
start "" "http://localhost:8000/app/index.html"
%PY% -m http.server 8000
