@echo off
echo ============================================================
echo   Starting Relay Music Bot (Docker Compose)
echo ============================================================
docker compose up -d --remove-orphans --build
if errorlevel 1 (
    echo.
    echo [HATA] Docker compose baslatilamadi. Lutfen Docker Desktop'un acik oldugundan emin olun.
    pause
    exit /b %errorlevel%
)
echo.
echo Konteynerler basariyla baslatildi!
echo Bot loglari canli aktariliyor (Cikmak icin Ctrl+C yapabilirsiniz):
echo ============================================================
docker compose logs -f bot
pause
