param(
  [string]$PrinterName = '',
  [string]$EnvPath = ''
)

$ErrorActionPreference = 'Stop'

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

if ([string]::IsNullOrWhiteSpace($EnvPath)) {
  $root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
  $EnvPath = Join-Path $root 'server\.env'
}

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
  $PrinterName = Get-EnvValue -Path $EnvPath -Name 'RECEIPT_PRINTER_NAME'
}

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
  $PrinterName = Get-EnvValue -Path $EnvPath -Name 'PRINTER_NAME'
}

try {
  Add-Type -AssemblyName System.Drawing
  $doc = New-Object System.Drawing.Printing.PrintDocument

  if (![string]::IsNullOrWhiteSpace($PrinterName)) {
    $doc.PrinterSettings.PrinterName = $PrinterName
  }

  if ($doc.PrinterSettings.IsValid) {
    if ([string]::IsNullOrWhiteSpace($PrinterName)) {
      Write-Host ("[OK] Receipt printer ready: Windows default ({0})" -f $doc.PrinterSettings.PrinterName)
    } else {
      Write-Host ("[OK] Receipt printer ready: {0}" -f $doc.PrinterSettings.PrinterName)
    }
    exit 0
  }

  if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    Write-Host '[WARNING] No valid Windows default printer is available.'
  } else {
    Write-Host ("[WARNING] Configured receipt printer is not available: {0}" -f $PrinterName)
  }

  $installedPrinters = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters
  if ($installedPrinters.Count -gt 0) {
    Write-Host 'Installed printers:'
    foreach ($printer in $installedPrinters) {
      Write-Host ("- {0}" -f $printer)
    }
  } else {
    Write-Host 'No installed printers were found.'
  }

  exit 1
} catch {
  Write-Host ("[WARNING] Could not check receipt printer: {0}" -f $_.Exception.Message)
  exit 1
}
