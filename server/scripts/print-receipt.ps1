param(
  [Parameter(Mandatory = $true)]
  [string]$ReceiptPath,

  [string]$PrinterName = ''
)

Add-Type -AssemblyName System.Drawing

if (!(Test-Path -LiteralPath $ReceiptPath)) {
  throw "Receipt file not found: $ReceiptPath"
}

$text = [System.IO.File]::ReadAllText($ReceiptPath, [System.Text.Encoding]::UTF8)
if ([string]::IsNullOrWhiteSpace($text)) {
  throw "Receipt is empty."
}

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.DocumentName = 'Bumblebee Receipt'

if (![string]::IsNullOrWhiteSpace($PrinterName)) {
  $doc.PrinterSettings.PrinterName = $PrinterName
}

if (-not $doc.PrinterSettings.IsValid) {
  if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    throw "Default printer is not available."
  }
  throw "Printer is not available: $PrinterName"
}

$fontName = 'Consolas'
if (-not ([System.Drawing.FontFamily]::Families | Where-Object { $_.Name -eq $fontName })) {
  $fontName = 'Courier New'
}
$font = New-Object System.Drawing.Font($fontName, 9, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
$brush = [System.Drawing.Brushes]::Black
$margin = New-Object System.Drawing.Printing.Margins(4, 4, 4, 4)
$doc.DefaultPageSettings.Margins = $margin

# 80mm is about 315 hundredths of an inch. Use a tall roll-paper page so
# Windows sends one continuous receipt to the thermal printer driver.
$lineCount = ($text -split "(`r`n|`n|`r)").Count
$height = [Math]::Max(500, [Math]::Min(2200, 120 + ($lineCount * 18)))
$paperSize = New-Object System.Drawing.Printing.PaperSize('Receipt 80mm', 315, $height)
$doc.DefaultPageSettings.PaperSize = $paperSize

$doc.add_PrintPage({
  param($sender, $eventArgs)

  $layout = New-Object System.Drawing.RectangleF(
    $eventArgs.MarginBounds.Left,
    $eventArgs.MarginBounds.Top,
    $eventArgs.MarginBounds.Width,
    $eventArgs.MarginBounds.Height
  )

  $format = New-Object System.Drawing.StringFormat
  $format.Trimming = [System.Drawing.StringTrimming]::Word
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit

  $eventArgs.Graphics.DrawString($text, $font, $brush, $layout, $format)
  $eventArgs.HasMorePages = $false
})

$doc.Print()
