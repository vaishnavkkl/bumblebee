@echo off
setlocal

cd /d "%~dp0"

echo ===================================================
echo   Bumblebee Car Wash Pro - Start App
echo ===================================================
echo.

node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

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

if exist "bumblebee\package.json" (
    if not exist "bumblebee\node_modules" (
        echo [WARNING] Mobile app dependencies are missing.
        echo Run auto_setup.bat to install them before starting the Expo mobile app.
        echo.
    )
)

echo Checking MySQL service...
call :ensure_mysql
if errorlevel 1 (
    echo.
    echo [WARNING] Could not confirm or start MySQL automatically.
    echo If the backend window shows a database error, start MySQL manually from Services, XAMPP/WAMP, or MySQL Workbench.
)

echo.
set "RUN_SCHEMA_SYNC=N"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$files = @('server\schema.sql','server\setup.js'); if (!(Test-Path '.tmp\server_schema_hash')) { exit 1 }; $saved = Get-Content '.tmp\server_schema_hash' -ErrorAction Stop; $current = Get-FileHash $files -Algorithm SHA256 | ForEach-Object { '{0}|{1}' -f $_.Path,$_.Hash }; if (Compare-Object $saved $current) { exit 1 } else { exit 0 }" >nul 2>&1
if errorlevel 1 (
    echo Database schema setup has not been recorded for this app version.
    echo Choose Y after installing an update that changed database features.
    set /p RUN_SCHEMA_SYNC="Run database schema update now? (Y/N): "
)

if /I "%RUN_SCHEMA_SYNC%"=="Y" (
    echo.
    echo Syncing database schema and catalog...
    pushd server
    node setup.js
    if errorlevel 1 (
        echo.
        echo [ERROR] Database schema sync failed.
        echo Check server\.env, confirm MySQL is running, then try again.
        popd
        pause
        exit /b 1
    )
    if not exist "..\.tmp" mkdir "..\.tmp" >nul 2>&1
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$files = @('schema.sql','setup.js'); Get-FileHash $files -Algorithm SHA256 | ForEach-Object { '{0}|{1}' -f $_.Path,$_.Hash } | Set-Content -Path '..\.tmp\server_schema_hash' -Encoding ASCII" >nul 2>&1
    popd
    echo Database schema is ready.
)

echo.
echo Checking receipt printer...
powershell -NoProfile -ExecutionPolicy Bypass -File "server\scripts\check-receipt-printer.ps1" -EnvPath "server\.env"
if errorlevel 1 (
    echo.
    echo [WARNING] Receipt printer is not ready.
    echo Printing will fail until the Gobbler thermal printer driver is installed
    echo and either set as the Windows default printer or configured in server\.env.
)

set "START_MOBILE=N"
if exist "bumblebee\package.json" (
    if exist "bumblebee\node_modules" (
        set /p START_MOBILE="Start Expo mobile app too? (Y/N): "
    )
)

echo.
echo Starting backend and frontend...
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
if /I "%START_MOBILE%"=="Y" echo Mobile:   Expo dev server window
echo Printer:  Windows default or RECEIPT_PRINTER_NAME in server\.env
echo.
echo Login details:
echo - Admin: admin@gmail.com / admin123
echo - Employee: sajith@gmail.com / sajith123
echo.

start "Bumblebee Backend" /D "%~dp0server" cmd /k npm start
start "Bumblebee Frontend" /D "%~dp0client" cmd /k npm run preview -- --host --port 3000
if /I "%START_MOBILE%"=="Y" (
    start "Bumblebee Mobile" /D "%~dp0bumblebee" cmd /k npm start
)

echo Waiting for backend to become ready...
powershell -NoProfile -Command "$ready = $false; for ($i = 1; $i -le 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch { Start-Sleep -Seconds 1 } }; if (-not $ready) { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [WARNING] Backend did not report ready yet.
    echo Check the backend window for database or startup errors.
) else (
    echo Backend is ready.
)

start "" "http://localhost:3000"

echo App is starting. You can close this window.
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
