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

:: 2. Configure Database
echo [STEP 1/5] Database Configuration
set /p DB_PASS="Enter your MySQL root password: "
echo.

:: Create .env file for the server
echo DB_HOST=127.0.0.1 > server\.env
echo DB_USER=root >> server\.env
echo DB_PASSWORD=!DB_PASS! >> server\.env
echo DB_NAME=bumblebee_db >> server\.env
echo JWT_SECRET=bumblebee_secret_key_2026 >> server\.env
echo PORT=5000 >> server\.env

echo [STEP 2/5] Seeding Database...
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
echo [STEP 3/5] Installing Backend Dependencies...
cd server
call npm install
cd ..

echo.
echo [STEP 4/5] Installing and Building Frontend...
cd client
call npm install
echo Building optimized production files...
call npm run build
cd ..

:: 4. Launch the application
echo.
echo [STEP 5/5] Launching Application...
echo.
echo ***************************************************
echo   SETUP COMPLETE! 
echo   The app is now starting in two windows.
echo   - Backend: http://localhost:5000
echo   - Frontend: http://localhost:3000
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
