@echo off
setlocal

cd /d "%~dp0"

node -v >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Please install Node.js first.
  pause
  exit /b 1
)

echo.
echo Bumblebee database clear tool
echo This clears transactional data from the current schema:
echo - bills, bill extra selections, payments, income, expenses
echo - attendance, salary payments, and salary advances
echo.
echo It keeps users, vehicle types, services, extra services,
echo workshops, expense categories, and server\.env settings.
echo The latest schema and Auto vehicle catalog are synchronized first.
echo.
echo Create a backup first if you need to keep historical data.
echo.
set /p CONFIRM=Type CLEAR to continue: 

if /I not "%CONFIRM%"=="CLEAR" (
  echo Cancelled. No database changes were made.
  pause
  exit /b 1
)

if not exist "server\.env" (
  echo server\.env not found. Run auto_setup.bat first.
  pause
  exit /b 1
)

if not exist "server\node_modules" (
  echo Backend dependencies are missing. Run auto_setup.bat first.
  pause
  exit /b 1
)

echo.
echo Synchronizing current database schema and vehicle catalog...
pushd server
node setup.js
if errorlevel 1 (
  echo.
  echo Database schema sync failed. Nothing was cleared.
  popd
  pause
  exit /b 1
)

echo.
echo Clearing transactional data...
node clear_database.js
set EXIT_CODE=%ERRORLEVEL%
if "%EXIT_CODE%"=="0" (
  if not exist "..\.tmp" mkdir "..\.tmp" >nul 2>&1
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$files = @('schema.sql','setup.js'); Get-FileHash $files -Algorithm SHA256 | ForEach-Object { '{0}|{1}' -f $_.Path,$_.Hash } | Set-Content -Path '..\.tmp\server_schema_hash' -Encoding ASCII" >nul 2>&1
)
popd

echo.
if not "%EXIT_CODE%"=="0" (
  echo Database clear failed.
) else (
  echo Database clear completed. The Auto vehicle catalog was preserved.
)
pause
exit /b %EXIT_CODE%
