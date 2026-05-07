@echo off
setlocal
cd /d "%~dp0"
echo Starting local server on http://localhost:3333 (close the server window to stop)
REM Uses npm.cmd (via CMD) so blocked npm.ps1 under PowerShell is avoided for the server window.
start "tyler.artdepot serve" cmd /k npm.cmd run serve
timeout /t 3 /nobreak >nul
start "" "http://localhost:3333"
