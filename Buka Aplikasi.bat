@echo off
cd /d "%~dp0"

:: Cek apakah server sudah jalan
curl -s --max-time 1 http://127.0.0.1:5678/status >nul 2>&1
if %errorlevel% == 0 (
    goto open_browser
)

:: Start server di background (tanpa jendela)
wscript "bot\start_server.vbs" "%~dp0bot"

:: Tunggu server siap (max 8 detik)
set /a tries=0
:wait_loop
timeout /t 1 /nobreak >nul
curl -s --max-time 1 http://127.0.0.1:5678/status >nul 2>&1
if %errorlevel% == 0 goto open_browser
set /a tries+=1
if %tries% lss 8 goto wait_loop

:open_browser
start "" "%~dp0index.html"
