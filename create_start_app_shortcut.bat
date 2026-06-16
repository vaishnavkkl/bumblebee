@echo off
setlocal

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut((Join-Path (Get-Location) 'Bumblebee Start App.lnk')); $shortcut.TargetPath = (Join-Path (Get-Location) 'start_app.bat'); $shortcut.WorkingDirectory = (Get-Location).Path; $shortcut.IconLocation = \"$env:SystemRoot\System32\shell32.dll,220\"; $shortcut.Description = 'Start Bumblebee Car Wash Pro'; $shortcut.Save()"

if errorlevel 1 (
    echo [ERROR] Could not create shortcut.
    pause
    exit /b 1
)

echo Created shortcut: Bumblebee Start App.lnk
if /I not "%~1"=="--quiet" pause
