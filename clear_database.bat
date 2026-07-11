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

node server\clear_database.js
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Database clear failed.
) else (
  echo Database clear completed.
)
pause
exit /b %EXIT_CODE%
