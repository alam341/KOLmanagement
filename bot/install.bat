@echo off
echo ================================
echo  Install TikTok DM Bot
echo ================================
echo.

:: Cek Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python belum terinstall!
    echo Download di: https://www.python.org/downloads/
    echo Centang "Add Python to PATH" saat install!
    pause
    exit /b
)

echo [1/3] Install library...
pip install playwright colorama

echo.
echo [2/3] Install browser Chromium untuk Playwright...
playwright install chromium

echo.
echo [3/3] Selesai!
echo.
echo Sekarang edit file config.json:
echo - Sesuaikan chrome_profile dengan username Windows kamu
echo - Isi brand, produk, dan komisi
echo - Atur template pesan
echo.
echo Lalu jalankan run.bat
pause
