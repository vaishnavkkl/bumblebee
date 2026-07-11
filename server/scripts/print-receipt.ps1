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
$font = New-Object System.Drawing.Font($fontName, 8, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
$brush = [System.Drawing.Brushes]::Black
$margin = New-Object System.Drawing.Printing.Margins(6, 6, 4, 4)
$doc.DefaultPageSettings.Margins = $margin

# 80 mm is about 315 hundredths of an inch. Size the roll page to the receipt
# content so the printer cuts after the bill instead of feeding a long blank
# section. The 8 pt monospace font uses roughly 15 hundredths per text line.
$lineCount = ($text -split "(`r`n|`n|`r)").Count
$height = [Math]::Max(180, [Math]::Min(1400, 35 + ($lineCount * 15)))
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
  $format.Trimming = [System.Drawing.StringTrimming]::None
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap

  $eventArgs.Graphics.DrawString($text, $font, $brush, $layout, $format)
  $eventArgs.HasMorePages = $false
})

$doc.Print()
