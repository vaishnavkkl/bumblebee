@echo off
setlocal

cd /d "%~dp0server"

if not exist ".env" (
  echo ERROR: server\.env not found.
  echo Please run setup first or create server\.env with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing server dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo Creating or updating admin user...
call npm run add-user -- --name=admin --phone=admin --password=admin123 --role=admin

if errorlevel 1 (
  echo.
  echo Failed to add admin user. Check server\.env database settings and MySQL service.
  pause
  exit /b 1
)

echo.
echo Creating or updating employee user...
call npm run add-user -- --name=sajith --phone=sajith --password=sajith123 --role=employee

if errorlevel 1 (
  echo.
  echo Failed to add employee user. Check server\.env database settings and MySQL service.
  pause
  exit /b 1
)

echo.
echo Users ready.
echo Admin username: admin
echo Admin password: admin123
echo.
echo Employee username: sajith
echo Employee password: sajith123
echo.
pause
