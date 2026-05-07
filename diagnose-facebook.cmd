@echo off
setlocal
cd /d "%~dp0"
node scripts\diagnose-facebook-env.mjs
