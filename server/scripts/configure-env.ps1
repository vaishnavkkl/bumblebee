param(
  [string]$EnvPath = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if ([string]::IsNullOrWhiteSpace($EnvPath)) {
  $EnvPath = Join-Path $root 'server\.env'
}

function Get-EnvValue {
  param(
    [string]$Path,
    [string]$Name
  )

  if (!(Test-Path -LiteralPath $Path)) { return $null }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match ("^{0}=(.*)$" -f [regex]::Escape($Name))) {
      return [string]$Matches[1]
    }
  }

  return $null
}

function Get-DefaultPrinterName {
  try {
    Add-Type -AssemblyName System.Drawing
    $settings = New-Object System.Drawing.Printing.PrinterSettings
    if ($settings.IsValid) { return [string]$settings.PrinterName }
  } catch {}

  return ''
}

$savedDbPass = Get-EnvValue -Path $EnvPath -Name 'DB_PASSWORD'
if ($env:BB_DB_PASS) {
  $dbPass = [string]$env:BB_DB_PASS
  Write-Host 'Using MySQL root password from BB_DB_PASS.'
} elseif ($null -ne $savedDbPass) {
  $dbPass = Read-Host 'Enter your MySQL root password [press Enter to keep saved]'
  if ($dbPass -eq '') { $dbPass = $savedDbPass }
} else {
  $dbPass = Read-Host 'Enter your MySQL root password'
}
$dbPass = ([string]$dbPass) -replace '[\r\n]', ''

$savedPrinter = Get-EnvValue -Path $EnvPath -Name 'RECEIPT_PRINTER_NAME'
$defaultPrinter = Get-DefaultPrinterName

Write-Host ''
if ($defaultPrinter) {
  Write-Host "Windows default printer: $defaultPrinter"
} else {
  Write-Host '[WARNING] No Windows default printer was detected.'
}

try {
  Add-Type -AssemblyName System.Drawing
  $installedPrinters = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters
  if ($installedPrinters.Count -gt 0) {
    Write-Host 'Installed printers:'
    foreach ($printer in $installedPrinters) {
      Write-Host ("- {0}" -f $printer)
    }
  }
} catch {}

if ($env:BB_RECEIPT_PRINTER_NAME) {
  $printerName = [string]$env:BB_RECEIPT_PRINTER_NAME
  Write-Host 'Using receipt printer from BB_RECEIPT_PRINTER_NAME.'
} elseif ($null -ne $savedPrinter) {
  $printerName = Read-Host 'Receipt printer name [press Enter to keep saved, type DEFAULT to use Windows default]'
  if ($printerName -eq '') { $printerName = $savedPrinter }
} else {
  $printerName = Read-Host 'Receipt printer name [press Enter to use Windows default]'
}

if ($printerName -ieq 'DEFAULT') { $printerName = '' }
$printerName = ([string]$printerName) -replace '[\r\n]', ''

$content = @(
  'DB_HOST=127.0.0.1',
  'DB_PORT=3306',
  'DB_USER=root',
  ('DB_PASSWORD=' + $dbPass),
  'DB_NAME=bumblebee_db',
  'JWT_SECRET=bumblebee_secret_key_2026',
  'PORT=5000',
  ('RECEIPT_PRINTER_NAME=' + $printerName)
)

Set-Content -LiteralPath $EnvPath -Value $content -Encoding ASCII
Write-Host ''
Write-Host "Wrote $EnvPath"
if ([string]::IsNullOrWhiteSpace($printerName)) {
  Write-Host 'Receipt printing will use the Windows default printer.'
} else {
  Write-Host "Receipt printing will use: $printerName"
}
