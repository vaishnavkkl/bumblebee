const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Forty monospace characters fit safely inside the printable area of an
// 80 mm roll, including printers that reserve a few millimetres at each edge.
const RECEIPT_WIDTH = 40;

const toNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const formatAmount = (value) => toNumber(value).toLocaleString('en-IN', {
  maximumFractionDigits: 2,
});

const clean = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim();

const center = (value) => {
  const text = clean(value).slice(0, RECEIPT_WIDTH);
  const left = Math.max(Math.floor((RECEIPT_WIDTH - text.length) / 2), 0);
  return `${' '.repeat(left)}${text}`;
};

const divider = () => '-'.repeat(RECEIPT_WIDTH);

const formatReceiptDate = (value) => {
  // mysql2 returns DATETIME/TIMESTAMP values as strings because dateStrings
  // is enabled. They already represent Asia/Kolkata wall time, so parsing and
  // timezone-converting them again would shift the printed time.
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (match) {
    const [, year, month, day, rawHour, minute, second = '00'] = match;
    const hour = Number(rawHour);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = String(hour % 12 || 12).padStart(2, '0');
    return `${day}/${month}/${year}, ${displayHour}:${minute}:${second} ${period}`;
  }

  const date = value ? new Date(value) : new Date();
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).replace(/\b(am|pm)\b/i, period => period.toUpperCase());
};

const leftRight = (left, right) => {
  const leftText = clean(left);
  const rightText = clean(right);
  const gap = RECEIPT_WIDTH - leftText.length - rightText.length;
  if (gap > 0) return `${leftText}${' '.repeat(gap)}${rightText}`;
  return `${leftText.slice(0, Math.max(RECEIPT_WIDTH - rightText.length - 1, 0))} ${rightText}`.slice(0, RECEIPT_WIDTH);
};

const paymentLabel = (bill) => {
  if (bill.payment_status === 'paid') return 'Paid';
  if (bill.payment_status === 'partial') return 'Partial';
  if (toNumber(bill.paid_amount) > 0 && toNumber(bill.balance_amount) > 0) return 'Partial';
  return 'Pending';
};

function buildReceiptText(bill) {
  const extras = Array.isArray(bill.extras) ? bill.extras : [];
  const extrasTotal = extras.reduce((sum, extra) => sum + toNumber(extra.price), 0);
  const subtotal = bill.subtotal != null
    ? toNumber(bill.subtotal)
    : toNumber(bill.service_price) + extrasTotal;
  const discount = toNumber(bill.discount_amount);
  const total = bill.total_amount != null
    ? toNumber(bill.total_amount)
    : Math.max(subtotal - discount, 0);
  const paid = toNumber(bill.paid_amount) + toNumber(bill.advance_amount);
  const balance = bill.balance_amount != null
    ? toNumber(bill.balance_amount)
    : Math.max(total - paid, 0);

  const lines = [
    divider(),
    leftRight('Bill No:', `#${bill.id}`),
    leftRight('Printed:', formatReceiptDate()),
    leftRight('Vehicle:', bill.vehicle_number || 'N/A'),
  ];

  if (bill.customer_mobile) lines.push(leftRight('Mobile:', bill.customer_mobile));
  lines.push(leftRight('Type:', bill.vehicle_type || ''));
  if (bill.workshop_name) lines.push(leftRight('Workshop:', bill.workshop_name));

  lines.push(divider(), 'Service:');
  lines.push(leftRight(`- ${bill.service_name || 'Service'}`, `Rs. ${formatAmount(bill.service_price)}`));

  if (extras.length > 0) {
    lines.push('Extras:');
    for (const extra of extras) {
      lines.push(leftRight(`- ${extra.name || 'Extra Service'}`, `Rs. ${formatAmount(extra.price)}`));
    }
  }

  lines.push(
    divider(),
    leftRight('Subtotal:', `Rs. ${formatAmount(subtotal)}`)
  );

  if (discount > 0) {
    lines.push(leftRight('Discount:', `-Rs. ${formatAmount(discount)}`));
  }

  lines.push(
    divider(),
    leftRight('TOTAL AMOUNT:', `Rs. ${formatAmount(total)}`),
    leftRight('PAID:', `Rs. ${formatAmount(paid)}`),
    leftRight('BALANCE:', `Rs. ${formatAmount(balance)}`)
  );
  lines.push(leftRight('Status:', paymentLabel(bill)));

  lines.push(
    divider(),
    center('Thank you for visiting!'),
    center('Please visit again.'),
    '',
    '',
    ''
  );

  return `${lines.join('\r\n')}\r\n`;
}

async function printReceipt(bill) {
  if (process.platform !== 'win32') {
    throw new Error('Direct receipt printing is available only on Windows.');
  }

  const receiptText = buildReceiptText(bill);
  const receiptPath = path.join(os.tmpdir(), `bumblebee-receipt-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  const scriptPath = path.join(__dirname, '..', 'scripts', 'print-receipt.ps1');
  const printerName = process.env.RECEIPT_PRINTER_NAME || process.env.PRINTER_NAME || '';

  await fs.writeFile(receiptPath, receiptText, 'utf8');

  try {
    await new Promise((resolve, reject) => {
      const args = [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-ReceiptPath',
        receiptPath,
      ];

      if (printerName) args.push('-PrinterName', printerName);

      const child = spawn('powershell.exe', args, { windowsHide: true });
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Printing timed out.'));
      }, 30000);

      child.stdout.on('data', chunk => { stdout += chunk.toString(); });
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', code => {
        clearTimeout(timer);
        if (code === 0) return resolve();
        reject(new Error((stderr || stdout || `Printer process exited with code ${code}`).trim()));
      });
    });
  } finally {
    await fs.unlink(receiptPath).catch(() => {});
  }

  return { printerName: printerName || 'Windows default printer' };
}

module.exports = { buildReceiptText, printReceipt };
