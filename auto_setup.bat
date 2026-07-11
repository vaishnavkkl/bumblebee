@echo off
setlocal

cd /d "%~dp0"

echo ===================================================
echo   Bumblebee Car Wash Pro - Auto Setup & Launch
echo ===================================================
echo.

:: 1. Check for Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

call npm -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not available. Reinstall Node.js and make sure npm is included.
    pause
    exit /b 1
)

echo Checking MySQL service...
call :ensure_mysql
if errorlevel 1 (
    echo.
    echo [WARNING] Could not confirm or start MySQL automatically.
    echo If setup fails, start MySQL manually from Services, XAMPP/WAMP, or MySQL Workbench.
)
echo.

:: 2. Configure Database and Receipt Printer
echo [STEP 1/7] Database and Receipt Printer Configuration
powershell -NoProfile -ExecutionPolicy Bypass -File "server\scripts\configure-env.ps1" -EnvPath "server\.env"
if errorlevel 1 (
    echo [ERROR] Failed to write server\.env.
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "server\scripts\check-receipt-printer.ps1" -EnvPath "server\.env"
if errorlevel 1 (
    echo.
    echo [WARNING] Receipt printer is not ready.
    echo Install the Gobbler thermal printer driver and set it as the Windows default printer,
    echo or rerun auto_setup.bat and enter the exact printer name.
)
echo.

echo [STEP 2/7] Installing Backend Dependencies...
pushd server
call npm install
if errorlevel 1 (
    echo.
    echo [ERROR] Backend dependency installation failed.
    popd
    pause
    exit /b 1
) else (
    echo [SUCCESS] Backend dependencies installed.
)

echo.
echo [STEP 3/7] Syncing Database Schema and Catalog...
node setup.js
if errorlevel 1 (
    echo.
    echo [ERROR] Database setup failed. Make sure:
    echo 1. MySQL is running.
    echo 2. The password you entered is correct.
    echo 3. server\.env has the correct database settings.
    popd
    pause
    exit /b 1
) else (
    echo [SUCCESS] Database schema and catalog are up to date.
    echo [INFO] Synced workshops, customer mobiles, bill extras, discounts, payment status, expense categories, and salary advances.
    if not exist "..\.tmp" mkdir "..\.tmp" >nul 2>&1
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$files = @('schema.sql','setup.js'); Get-FileHash $files -Algorithm SHA256 | ForEach-Object { '{0}|{1}' -f $_.Path,$_.Hash } | Set-Content -Path '..\.tmp\server_schema_hash' -Encoding ASCII" >nul 2>&1
)

echo.
echo.
echo [STEP 4/7] Updating Default Login Users...
node migrate_users.js
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to create or update default users.
    echo Check server\.env database settings and make sure MySQL is running.
    popd
    pause
    exit /b 1
)
popd

echo.
echo [STEP 5/7] Installing and Building Web Frontend...
pushd client
call npm install
if errorlevel 1 (
    echo.
    echo [ERROR] Frontend dependency installation failed.
    popd
    pause
    exit /b 1
)
echo Building optimized production files...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Frontend build failed.
    popd
    pause
    exit /b 1
)
popd

echo.
echo [STEP 6/7] Installing Mobile App Dependencies...
if exist "bumblebee\package.json" (
    pushd bumblebee
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Mobile app dependency installation failed.
        popd
        pause
        exit /b 1
    )
    popd
    echo [SUCCESS] Mobile app dependencies installed.
) else (
    echo [SKIPPED] Mobile app folder was not found.
)

:: 4. Launch the application
echo.
echo [STEP 7/7] Launching Application...
set "START_MOBILE=N"
if exist "bumblebee\package.json" (
    set /p START_MOBILE="Start Expo mobile app too? (Y/N): "
)
echo.
echo ***************************************************
echo   SETUP COMPLETE! 
echo   The app is now starting.
echo   - Backend: http://localhost:5000
echo   - Frontend: http://localhost:3000
if /I "%START_MOBILE%"=="Y" echo   - Mobile: Expo dev server window
echo   - Receipt printer: Windows default or RECEIPT_PRINTER_NAME in server\.env
echo.
echo   Login details:
echo   - Admin: admin@gmail.com / admin123
echo   - Employee: sajith@gmail.com / sajith123
echo.
echo   Next time, use start_app.bat to open the app.
echo ***************************************************
echo.

:: Start Backend
start "Bumblebee Backend" /D "%~dp0server" cmd /k npm start

:: Start Frontend (Production Preview)
start "Bumblebee Frontend" /D "%~dp0client" cmd /k npm run preview -- --host --port 3000

if /I "%START_MOBILE%"=="Y" (
    start "Bumblebee Mobile" /D "%~dp0bumblebee" cmd /k npm start
)

echo.
echo You can now close this setup window.
echo Open http://localhost:3000 in your browser.
pause
exit /b 0

:ensure_mysql
powershell -NoProfile -Command "try { $client = New-Object Net.Sockets.TcpClient; $async = $client.BeginConnect('127.0.0.1', 3306, $null, $null); if ($async.AsyncWaitHandle.WaitOne(1000, $false)) { $client.EndConnect($async); $client.Close(); exit 0 }; $client.Close(); exit 1 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo MySQL is already accepting connections on port 3306.
    exit /b 0
)

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

set "MYSQL_SERVICE="
for /f "usebackq delims=" %%S in (`powershell -NoProfile -Command "Get-Service | Where-Object { $_.Name -match 'mysql|maria' -or $_.DisplayName -match 'mysql|maria' } | Select-Object -ExpandProperty Name -First 1"`) do if not defined MYSQL_SERVICE set "MYSQL_SERVICE=%%S"

if defined MYSQL_SERVICE (
    echo Starting MySQL service %MYSQL_SERVICE%...
    net start "%MYSQL_SERVICE%" >nul 2>&1
    if not errorlevel 1 (
        echo MySQL service %MYSQL_SERVICE% started.
        exit /b 0
    )
    echo [WARNING] Could not start MySQL service %MYSQL_SERVICE%.
    exit /b 1
)

echo [WARNING] MySQL service was not found.
exit /b 1
