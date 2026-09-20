import { BRAND_ADDRESS, BRAND_EMAIL, BRAND_EN, BRAND_INSTAGRAM, BRAND_PRIMARY_PHONE_DISPLAY } from './brand'
import { formatCurrency, formatInvoiceNo } from './retail'
import { formatPhoneDisplay } from './phone'
import { useSettingsStore } from '../store/store'

export interface ThermalReceiptData {
  invoiceNo: string
  date: string
  customerName?: string
  phone?: string
  items: Array<{
    name: string
    qty: number
    unit?: string
    price: number
    line_total?: number
  }>
  subtotal: number
  shipping: number
  couponDiscount?: number
  manualDiscount?: number
  totalGst?: number
  total: number
  storeName?: string
  storePhone?: string
  storeAddress?: string
  storeEmail?: string
  isCredit?: boolean
  creditDueDate?: string | null
}

export function printThermalReceipt(data: ThermalReceiptData) {
  // Create an iframe to hold the print document
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) return

  const liveSettings = useSettingsStore.getState().settings
  const storeName = data.storeName || liveSettings?.name || BRAND_EN
  const storeAddress = data.storeAddress || liveSettings?.address || BRAND_ADDRESS
  const storePhone = data.storePhone || liveSettings?.phone || BRAND_PRIMARY_PHONE_DISPLAY
  const storeEmail = data.storeEmail || liveSettings?.email || BRAND_EMAIL
  const storeInstagram = liveSettings?.instagramHandle || BRAND_INSTAGRAM

  const dateStr = (() => {
    try { return new Date(data.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return new Date().toLocaleString('en-IN') }
  })()

  const dueDateStr = data.creditDueDate
    ? (() => {
        try { return new Date(`${data.creditDueDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
        catch { return data.creditDueDate as string }
      })()
    : ''

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${data.invoiceNo}</title>
        <style>
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: 12px;
            font-weight: 600;
            color: #000;
            margin: 0;
            padding: 4mm;
            width: 80mm;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
          .border-top { border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 2px 0; vertical-align: top; }
          .item-name { font-size: 11px; padding-right: 4px; }
        </style>
      </head>
      <body>
        <div class="text-center mb-2">
          <div class="font-bold" style="font-size: 16px; letter-spacing: 2px;">${storeName}</div>
          <div style="font-size: 10px; margin-top: 2px;">${storeAddress}</div>
          <div class="mt-1" style="font-size: 10px;">Ph: ${storePhone}</div>
          <div style="font-size: 9px; color: #000;">${storeEmail} | Insta: @${storeInstagram}</div>
        </div>

        <div class="border-bottom border-top" style="font-size: 11px;">
          <div>Inv: #${formatInvoiceNo(data.invoiceNo)}</div>
          <div>Date: ${dateStr}</div>
          ${data.customerName ? `<div>Name: ${data.customerName}</div>` : ''}
          ${data.phone ? `<div>Tel: ${formatPhoneDisplay(data.phone)}</div>` : ''}
        </div>

        ${data.isCredit ? `
          <div class="text-center border-bottom" style="font-size: 12px; font-weight: bold; padding: 3px 0; border: 1px dashed #000; margin-bottom: 4px;">
            *** CREDIT BILL ***<br/>
            ${dueDateStr ? `PAY BY: ${dueDateStr}` : 'PAYMENT PENDING'}
          </div>
        ` : ''}

        <table class="border-bottom">
          <thead>
            <tr style="font-size: 10px; border-bottom: 1px dashed #000;">
              <th class="text-left">Item</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => {
              const lineTotal = item.line_total ?? (item.qty * item.price)
              const unit = item.unit && item.unit !== 'unit' && item.unit !== 'piece' ? item.unit : ''
              return `
                <tr>
                  <td class="text-left item-name">
                    ${item.name} <br/>
                    <span style="font-size: 9px; color: #000;">@ ${formatCurrency(item.price)}${unit ? ` / ${unit}` : ' each'}</span>
                  </td>
                  <td class="text-right">${item.qty}</td>
                  <td class="text-right">${formatCurrency(lineTotal)}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        <div class="border-bottom" style="font-size: 12px;">
          <table style="width: 100%;">
            ${data.subtotal !== data.total ? `
              <tr>
                <td class="text-left">Subtotal</td>
                <td class="text-right">${formatCurrency(data.subtotal)}</td>
              </tr>
            ` : ''}
            ${(data.couponDiscount || 0) > 0 ? `
              <tr>
                <td class="text-left">Coupon</td>
                <td class="text-right">-${formatCurrency(data.couponDiscount || 0)}</td>
              </tr>
            ` : ''}
            ${(data.manualDiscount || 0) > 0 ? `
              <tr>
                <td class="text-left">Manual Disc.</td>
                <td class="text-right">-${formatCurrency(data.manualDiscount || 0)}</td>
              </tr>
            ` : ''}
            ${(data.totalGst || 0) > 0 ? `
              <tr>
                <td class="text-left">GST</td>
                <td class="text-right">+${formatCurrency(data.totalGst || 0)}</td>
              </tr>
            ` : ''}
            ${data.shipping > 0 ? `
              <tr>
                <td class="text-left">Delivery</td>
                <td class="text-right">${formatCurrency(data.shipping)}</td>
              </tr>
            ` : ''}
            <tr class="font-bold" style="font-size: 14px;">
              <td class="text-left">${data.isCredit ? 'Amount Due' : 'Total'}</td>
              <td class="text-right">${formatCurrency(data.total)}</td>
            </tr>
          </table>
        </div>

        <div class="text-center mt-2" style="font-size: 11px;">
          ${data.isCredit
            ? `<div class="font-bold">Credit sale — kindly settle${dueDateStr ? ` by ${dueDateStr}` : ''}. Thank you!</div>`
            : `<div class="font-bold">Thank you for shopping at ${storeName}!</div>`}
          <div>Follow us on Instagram: @${storeInstagram}</div>
        </div>
      </body>
    </html>
  `

  doc.open()
  doc.write(html)
  doc.close()

  const runPrint = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }

  setTimeout(runPrint, 250)
}
