@echo off
setlocal

cd /d "%~dp0"

echo ===================================================
echo   Bumblebee Car Wash Pro - Start App
echo ===================================================
echo.

if not exist "server\.env" (
    echo [ERROR] server\.env not found.
    echo Run auto_setup.bat once before using this launcher.
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo [ERROR] Backend dependencies are missing.
    echo Run auto_setup.bat once before using this launcher.
    pause
    exit /b 1
)

if not exist "client\node_modules" (
    echo [ERROR] Frontend dependencies are missing.
    echo Run auto_setup.bat once before using this launcher.
    pause
    exit /b 1
)

if not exist "client\dist" (
    echo [ERROR] Frontend build files are missing.
    echo Run auto_setup.bat once before using this launcher.
    pause
    exit /b 1
)

echo Checking MySQL service...
call :ensure_mysql
if errorlevel 1 (
    echo.
    echo [ERROR] MySQL is not running.
    echo Start MySQL manually, or right-click this file and choose "Run as administrator".
    pause
    exit /b 1
)

echo.
echo Starting backend and frontend...
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Login details:
echo - Admin: admin@gmail.com / admin123
echo - Employee: sajith@gmail.com / sajith123
echo.

start "Bumblebee Backend" /D "%~dp0server" cmd /k npm start
start "Bumblebee Frontend" /D "%~dp0client" cmd /k npm run preview -- --host --port 3000

timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

echo App is starting. You can close this window.
pause
exit /b 0

:ensure_mysql
for %%S in (MySQL80 MySQL MySQL57 MySQL56 MariaDB MariaDB10) do (
    sc query "%%S" >nul 2>&1
    if not errorlevel 1 (
        sc query "%%S" | find /I "RUNNING" >nul
        if not errorlevel 1 (
            echo MySQL service %%S is already running.
            exit /b 0
        )

        echo Starting MySQL service %%S...
        net start "%%S" >nul 2>&1
        if not errorlevel 1 (
            echo MySQL service %%S started.
            exit /b 0
        )

        echo [WARNING] Could not start MySQL service %%S.
        exit /b 1
    )
)

echo [WARNING] MySQL service was not found under common names.
exit /b 1
