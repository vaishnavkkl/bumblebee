@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Bumblebee Car Wash Pro - Auto Setup & Launch
echo ===================================================
echo.

:: 1. Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b
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

:: 2. Configure Database
echo [STEP 1/6] Database Configuration
set /p DB_PASS="Enter your MySQL root password: "
echo.

:: Create .env file for the server
echo DB_HOST=127.0.0.1 > server\.env
echo DB_USER=root >> server\.env
echo DB_PASSWORD=!DB_PASS! >> server\.env
echo DB_NAME=bumblebee_db >> server\.env
echo JWT_SECRET=bumblebee_secret_key_2026 >> server\.env
echo PORT=5000 >> server\.env

echo [STEP 2/6] Seeding Database...
:: Try to run mysql. Note: mysql must be in your System PATH
mysql -u root -p"!DB_PASS!" < server\schema.sql
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] MySQL command failed. Make sure:
    echo 1. MySQL is running.
    echo 2. The 'mysql' command is in your System Environment Variables PATH.
    echo 3. The password you entered is correct.
    echo.
    echo You can manually run the SQL in MySQL Workbench if this fails.
    pause
) else (
    echo [SUCCESS] Database seeded successfully.
)

:: 3. Install Dependencies
echo.
echo [STEP 3/6] Installing Backend Dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Backend dependency installation failed.
    pause
    exit /b 1
)

echo.
echo [STEP 4/6] Updating Default Users...
node migrate_users.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to create or update default users.
    echo Check server\.env database settings and make sure MySQL is running.
    pause
    exit /b 1
)
cd ..

echo.
echo [STEP 5/6] Installing and Building Frontend...
cd client
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Frontend dependency installation failed.
    pause
    exit /b 1
)
echo Building optimized production files...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)
cd ..

echo.
echo Creating Start App shortcut...
call create_start_app_shortcut.bat --quiet
if %errorlevel% neq 0 (
    echo [WARNING] Could not create Bumblebee Start App shortcut.
)

:: 4. Launch the application
echo.
echo [STEP 6/6] Launching Application...
echo.
echo ***************************************************
echo   SETUP COMPLETE! 
echo   The app is now starting in two windows.
echo   - Backend: http://localhost:5000
echo   - Frontend: http://localhost:3000
echo.
echo   Login details:
echo   - Admin: admin@gmail.com / admin123
echo   - Employee: sajith@gmail.com / sajith123
echo.
echo   Next time, use start_app.bat to open the app.
echo ***************************************************
echo.

:: Start Backend
start "Bumblebee Backend" cmd /k "cd server && npm start"

:: Start Frontend (Production Preview)
start "Bumblebee Frontend" cmd /k "cd client && npm run preview -- --host --port 3000"

echo.
echo You can now close this setup window.
echo Open http://localhost:3000 in your browser.
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
