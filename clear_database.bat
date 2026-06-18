@echo off
setlocal

cd /d "%~dp0"

echo.
echo Bumblebee database clear tool
echo This clears bills, payments, income, expenses, attendance, and salary data.
echo It keeps users, vehicle types, services, and extra services.
echo.
set /p CONFIRM=Type CLEAR to continue: 

if /I not "%CONFIRM%"=="CLEAR" (
  echo Cancelled. No database changes were made.
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
