const formatAmount = (value) => Number(value || 0).toLocaleString('en-IN');

export function printBill(bill) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;

  const extrasHtml = (bill.extras || []).map(extra => `
    <div class="row item-row">
      <span>- ${extra.name || 'Extra Service'}</span>
      <span>Rs. ${formatAmount(extra.price)}</span>
    </div>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Bumblebee Bill - #${bill.id}</title>
        <style>
          @page { margin: 0; }
          body { font-family: "Courier New", Courier, monospace; width: 80mm; padding: 10mm; margin: 0; color: #000; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .row { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 5px; font-size: 14px; }
          .item-row { font-size: 12px; margin-left: 10px; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          .total { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 16px; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        </style>
      </head>
      <body onload="window.print(); setTimeout(function(){ window.close(); }, 500);">
        <div class="header">
          <h2 style="margin:0;">BUMBLEBEE</h2>
          <p style="margin:0; font-size:12px;">Premium Car Wash</p>
        </div>
        <div class="row"><span>Bill No:</span> <span>#${bill.id}</span></div>
        <div class="row"><span>Date:</span> <span>${new Date(bill.created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
        <div class="row"><span>Vehicle:</span> <span>${bill.vehicle_number || 'N/A'}</span></div>
        ${bill.customer_mobile ? `<div class="row"><span>Mobile:</span> <span>${bill.customer_mobile}</span></div>` : ''}
        <div class="row"><span>Type:</span> <span>${bill.vehicle_type || ''}</span></div>
        <div class="divider"></div>
        <div class="row" style="margin-bottom:2px;"><strong>Service:</strong></div>
        <div class="row item-row">
          <span>- ${bill.service_name || 'Service'}</span>
          <span>Rs. ${formatAmount(bill.service_price)}</span>
        </div>
        ${extrasHtml ? `<div class="row" style="margin-top:5px; margin-bottom:2px;"><strong>Extras:</strong></div>${extrasHtml}` : ''}
        <div class="total">
          <div class="row"><span>Subtotal:</span> <span>Rs. ${formatAmount(bill.subtotal)}</span></div>
          ${Number(bill.discount_amount || 0) > 0 ? `<div class="row"><span>Discount:</span> <span>-Rs. ${formatAmount(bill.discount_amount)}</span></div>` : ''}
          <div class="row"><span>Total:</span> <span>Rs. ${formatAmount(bill.total_amount)}</span></div>
          <div class="row"><span>Status:</span> <span>${bill.payment_status === 'paid' ? 'Paid' : 'Pending'}</span></div>
        </div>
        <div class="footer">
          <p>Thank you for visiting!</p>
          <p>Please visit again.</p>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}
