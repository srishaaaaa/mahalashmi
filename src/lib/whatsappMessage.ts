import { formatInvoiceNo } from './retail'
import { BRAND_EN, BRAND_INSTAGRAM, BRAND_PRIMARY_PHONE_DISPLAY, BRAND_PRODUCTION_DOMAIN } from './brand'
import { useSettingsStore } from '../store/store'

function getShopInfo() {
  const storeSettings = useSettingsStore.getState().settings
  const instagramHandle = storeSettings?.instagramHandle || BRAND_INSTAGRAM
  return {
    name: storeSettings?.name || BRAND_EN,
    phone: storeSettings?.phone || BRAND_PRIMARY_PHONE_DISPLAY,
    instagramHandle,
    instagramUrl: `https://instagram.com/${instagramHandle}`,
  }
}

export type WhatsAppLineItem = {
  name: string
  qty: number
  unit: string
  unitType: 'unit' | 'weight' | 'volume' | 'bundle'
  rate: number
  lineTotal: number
}

export type BuildWhatsAppMessageInput = {
  customerName?: string
  phone?: string
  invoiceNumber: string
  invoiceDate?: string
  invoiceUrl?: string
  paymentMode?: string
  items?: WhatsAppLineItem[]
  subtotal?: number
  couponDiscount?: number
  manualDiscountAmount?: number
  shipping?: number
  gstAmount?: number
  total?: number
  isCredit?: boolean
  creditDueDate?: string | null
  creditPaidAt?: string | null
}

export type CreditReminderWhatsAppInput = {
  customerName?: string
  invoiceNumber: string
  amount: number
  dueDate?: string | null
  daysOverdue: number
}

export type AdvanceDepositWhatsAppInput = {
  customerName?: string
  depositId: string
  productName: string
  totalAmount: number
  depositAmount: number
  remainingBalance: number
  expectedDeliveryDate: string
  paymentMethod?: string
}

export const publicInvoiceUrl = (invoiceNumber: string) => {
  const formatted = formatInvoiceNo(invoiceNumber)
  const envUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '')
  const origin =
    envUrl ||
    (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : BRAND_PRODUCTION_DOMAIN)
  return `${origin}/invoice/${encodeURIComponent(formatted)}`
}

export const buildProfessionalWhatsAppMessage = (input: BuildWhatsAppMessageInput) => {
  const shop = getShopInfo()
  const customerName = input.customerName?.trim() || 'Valued Customer'
  const invoiceUrl = input.invoiceUrl || publicInvoiceUrl(input.invoiceNumber)
  const formattedNo = formatInvoiceNo(input.invoiceNumber)
  const itemsText = input.items && input.items.length > 0
    ? input.items.map(item => `• ${item.name} (x${item.qty}) - ₹ ${Number(item.lineTotal || 0).toFixed(2)}`).join('\n')
    : ''

  const dueDateText = input.creditDueDate
    ? new Date(`${input.creditDueDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''
  const paidDateText = input.creditPaidAt
    ? new Date(input.creditPaidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''
  const isSettledCredit = Boolean(input.isCredit && input.creditPaidAt)
  const creditBlock = input.isCredit
    ? isSettledCredit
      ? `\n✅ *CREDIT BILL — PAID (COMPLETED)*\n${paidDateText ? `📅 *Paid On:* ${paidDateText}\n` : ''}\n`
      : `\n🔴 *CREDIT SALE — PAYMENT PENDING*\n${dueDateText ? `📅 *Due Date:* ${dueDateText}\n` : ''}Kindly settle this amount by the due date. Thank you!\n`
    : ''

  return `✨ *${shop.name}* ✨
🛍️ *Official Purchase Invoice & Receipt* 🛍️

Dear ${customerName},

Thank you for shopping at ${shop.name}! We truly appreciate your patronage.

🧾 *INVOICE DETAILS*
📌 *Invoice No:* #${formattedNo}
${input.invoiceDate ? `📅 *Date:* ${new Date(input.invoiceDate).toLocaleDateString('en-IN')}\n` : ''}${input.paymentMode ? `💳 *Payment Mode:* ${input.paymentMode}\n` : ''}${input.total !== undefined ? `💰 *Total Amount:* ₹ ${Number(input.total || 0).toFixed(2)}\n` : ''}${creditBlock}
${itemsText ? `📦 *ITEMS ORDERED:*\n${itemsText}\n\n` : ''}📄 *View & Download Digital Invoice / PDF:*
👉 ${invoiceUrl}

📞 *Shop Contact:* ${shop.phone}
📷 *Follow us on Instagram:* ${shop.instagramUrl}

Thank you, and visit us again! ✨`
}

export const buildCreditReminderWhatsAppMessage = (input: CreditReminderWhatsAppInput) => {
  const shop = getShopInfo()
  const customerName = input.customerName?.trim() || 'Valued Customer'
  const formattedNo = formatInvoiceNo(input.invoiceNumber)
  const dueDateText = input.dueDate
    ? new Date(`${input.dueDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-'
  const statusLine = input.daysOverdue > 0
    ? `⚠️ This payment is *${input.daysOverdue} day${input.daysOverdue > 1 ? 's' : ''} overdue*.`
    : input.daysOverdue === 0
      ? '⏰ This payment is *due today*.'
      : `📅 This payment is due on *${dueDateText}*.`

  return `🔔 *Payment Reminder — ${shop.name}* 🔔

Dear ${customerName},

This is a friendly reminder about your pending credit purchase.

🧾 *Invoice No:* #${formattedNo}
💰 *Amount Due:* ₹ ${Number(input.amount || 0).toFixed(2)}
📅 *Due Date:* ${dueDateText}
${statusLine}

Kindly clear the payment at your earliest convenience. Thank you for your continued support!

📞 *Shop Contact:* ${shop.phone}`
}

export const buildAdvanceDepositWhatsAppMessage = (input: AdvanceDepositWhatsAppInput) => {
  const shop = getShopInfo()
  const customerName = input.customerName?.trim() || 'Valued Customer'
  const deliveryDateFormatted = input.expectedDeliveryDate
    ? (() => {
        try {
          return new Date(`${input.expectedDeliveryDate}T00:00:00`).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        } catch {
          return input.expectedDeliveryDate
        }
      })()
    : '-'

  return `✨ *Thank You for Your Advance Order with ${shop.name}!* ✨

Dear ${customerName},

We have successfully received your initial advance payment!

🧾 *Advance Order Details* 👇
📦 Deposit ID: #${input.depositId}
👔 Product: ${input.productName}
💵 Total Order Amount: ₹${input.totalAmount}
💰 Advance Paid: ₹${input.depositAmount}${input.paymentMethod ? ` (${input.paymentMethod.toLowerCase() === 'upi' ? 'QR' : input.paymentMethod.toUpperCase()})` : ''}
🔴 Balance to Pay on Delivery: ₹${input.remainingBalance}
📅 Expected Delivery Date: ${deliveryDateFormatted}

Your garments are being prepared with utmost care. We will have everything ready on or before ${deliveryDateFormatted}!

📞 *Shop Contact:* ${shop.phone}
📷 *Instagram:* @${shop.instagramHandle}`
}
