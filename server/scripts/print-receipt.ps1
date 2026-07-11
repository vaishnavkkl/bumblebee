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
$titleFont = New-Object System.Drawing.Font($fontName, 11, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Point)
$subtitleFont = New-Object System.Drawing.Font($fontName, 8, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
$brush = [System.Drawing.Brushes]::Black
$margin = New-Object System.Drawing.Printing.Margins(6, 6, 4, 4)
$doc.DefaultPageSettings.Margins = $margin

# 80 mm is about 315 hundredths of an inch. Size the roll page to the receipt
# content so the printer cuts after the bill instead of feeding a long blank
# section. Header space includes the larger title and unchanged subtitle.
$lineCount = ($text -split "(`r`n|`n|`r)").Count
$headerHeight = 42
$height = [Math]::Max(180, [Math]::Min(1400, 35 + $headerHeight + ($lineCount * 15)))
$paperSize = New-Object System.Drawing.Printing.PaperSize('Receipt 80mm', 315, $height)
$doc.DefaultPageSettings.PaperSize = $paperSize

$doc.add_PrintPage({
  param($sender, $eventArgs)

  $centerFormat = New-Object System.Drawing.StringFormat
  $centerFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $centerFormat.LineAlignment = [System.Drawing.StringAlignment]::Near

  $titleLayout = New-Object System.Drawing.RectangleF(
    $eventArgs.MarginBounds.Left,
    $eventArgs.MarginBounds.Top,
    $eventArgs.MarginBounds.Width,
    22
  )
  $eventArgs.Graphics.DrawString('BUMBLEBEE AUTO GARAGE', $titleFont, $brush, $titleLayout, $centerFormat)

  $subtitleLayout = New-Object System.Drawing.RectangleF(
    $eventArgs.MarginBounds.Left,
    $eventArgs.MarginBounds.Top + 23,
    $eventArgs.MarginBounds.Width,
    16
  )
  $eventArgs.Graphics.DrawString('Premium Car Wash', $subtitleFont, $brush, $subtitleLayout, $centerFormat)

  $layout = New-Object System.Drawing.RectangleF(
    $eventArgs.MarginBounds.Left,
    $eventArgs.MarginBounds.Top + $headerHeight,
    $eventArgs.MarginBounds.Width,
    $eventArgs.MarginBounds.Height - $headerHeight
  )

  $format = New-Object System.Drawing.StringFormat
  $format.Trimming = [System.Drawing.StringTrimming]::None
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap

  $eventArgs.Graphics.DrawString($text, $font, $brush, $layout, $format)
  $eventArgs.HasMorePages = $false
})

$doc.Print()
