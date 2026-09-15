import React from 'react'
import { BRAND_ADDRESS, BRAND_EMAIL, BRAND_EN, BRAND_INSTAGRAM, BRAND_LOGO, BRAND_PRIMARY_PHONE_DISPLAY } from '../lib/brand'
import { formatCurrency, formatQuantityDisplay, normalizeStructuredOrderItem, formatInvoiceNo } from '../lib/retail'
import { formatPhoneDisplay } from '../lib/phone'
import { useSettingsStore } from '../store/store'

export interface InvoiceItem {
  id?: number | string
  product_id?: number | null
  name: string
  nameTa?: string | null
  tamil_name?: string | null
  qty: number
  quantity?: number
  unit?: string
  unit_type?: 'unit' | 'weight' | 'volume' | 'bundle'
  base_quantity?: number
  base_price?: number
  line_total?: number
  price: number
  offerPrice?: number | null
  special_offer_note?: string | null
  special_offer_cost?: number | null
}

export interface InvoiceProps {
  invoiceNo: string
  date: string
  customerName: string
  phone: string
  address: string
  items: InvoiceItem[]
  subtotal: number
  shipping: number
  total: number
  status?: string
  userId?: string
  deliveryCharge?: number
  discountAmount?: number
  couponCode?: string | null
  manualDiscountAmount?: number
  gstAmount?: number
  paymentMode?: string
  onPrintReceipt?: () => void
}

export const Invoice: React.FC<InvoiceProps> = ({
  invoiceNo,
  date,
  customerName,
  phone,
  address,
  items,
  subtotal,
  shipping,
  total,
  status = 'Pending',
  userId,
  deliveryCharge = 0,
  discountAmount = 0,
  couponCode,
  manualDiscountAmount = 0,
  gstAmount = 0,
  paymentMode,
  onPrintReceipt,
}) => {
  const formattedInvoiceNo = formatInvoiceNo(invoiceNo)
  const dateStr = (() => {
    try { return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  })()

  const statusColor = status === 'completed' ? '#2E7D32' : status === 'cancelled' ? '#dc2626' : '#d97706'
  const effectiveDelivery = deliveryCharge || shipping
  const storeSettings = useSettingsStore(s => s.settings)
  const logoUrl = storeSettings?.logoUrl || BRAND_LOGO
  const shopName = storeSettings?.name || BRAND_EN
  const shopAddress = storeSettings?.address || BRAND_ADDRESS
  const shopPhone = storeSettings?.phone || BRAND_PRIMARY_PHONE_DISPLAY
  const shopEmail = storeSettings?.email || BRAND_EMAIL
  const shopInstagram = storeSettings?.instagramHandle || BRAND_INSTAGRAM

  return (
    <div
      id="invoice-print-root"
      className="w-full max-w-[794px] mx-auto bg-white text-[#111111] box-border flex flex-col p-6 sm:p-[45px] print:p-0 print:max-w-full border border-[#B7E1BE]/40 shadow-xl rounded-3xl h-auto"
      style={{
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Tax Invoice</div>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#0A0A0A', textTransform: 'uppercase', letterSpacing: 0.5 }}>Invoice: #{formattedInvoiceNo}</div>
      </div>
      <div style={{ borderBottom: '1px solid #B7E1BE', marginTop: 8, marginBottom: 16 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: '1px solid #2E7D32', overflow: 'hidden', boxShadow: '0 4px 12px rgba(46, 125, 50,0.15)' }}>
            <img src={logoUrl} alt={shopName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#2E7D32', letterSpacing: 1, textTransform: 'uppercase' }}>
              {shopName}
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2, maxWidth: 280 }}>
              {shopAddress}
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>📞 {shopPhone}</span>
              <span>✉️ {shopEmail}</span>
              <span>📷 @{shopInstagram}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#4b5563' }}>Date: {dateStr}</div>
          {paymentMode && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>Payment: {paymentMode}</div>}
          {userId && <div style={{ fontSize: 9, color: '#999', marginTop: 4, wordBreak: 'break-all', maxWidth: 180 }}>{userId}</div>}
          <div
            style={{
              display: 'inline-block', marginTop: 8, padding: '3px 12px', borderRadius: 99,
              background: statusColor + '18', color: statusColor,
              fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', border: `1px solid ${statusColor}40`
            }}
          >
            {status}
          </div>
        </div>
      </div>

      {/* ── BILL TO ──────────────────────────────────────────────── */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: '#FBFAF6', border: '1px solid #B7E1BE', overflowWrap: 'anywhere', marginBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Bill To</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0A0A0A', lineHeight: 1.35, wordBreak: 'break-word', marginTop: 6 }}>{customerName || 'Walk-in Customer'}</div>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 6 }}>Mobile Number</div>
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.4, wordBreak: 'break-word' }}>{phone ? formatPhoneDisplay(phone) : '—'}</div>
        {address && <div style={{ fontSize: 11, color: '#777', marginTop: 4, lineHeight: 1.4, wordBreak: 'break-word' }}>Address: {address}</div>}
      </div>

      {/* ── ITEMS TABLE ──────────────────────────────────────────── */}
      <div className="w-full overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
          <thead>
            <tr style={{ background: '#0A0A0A', borderRadius: 8 }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.8, width: 28 }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.8 }}>Item Description</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.8, width: 45 }}>Qty</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.8, width: 75 }}>Rate</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.8, width: 85 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const normalized = normalizeStructuredOrderItem(item as unknown as Record<string, unknown>)
              const displayName = normalized.tamil_name || item.nameTa || normalized.name
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 8px', fontSize: 11, color: '#999', verticalAlign: 'top' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0A0A0A' }}>{normalized.name}</div>
                    {displayName && displayName !== normalized.name && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{displayName}</div>}
                    {item.offerPrice && item.price !== item.offerPrice && (
                      <div style={{ fontSize: 10, color: '#aaa', textDecoration: 'line-through', marginTop: 2 }}>MRP ₹{item.price}</div>
                    )}
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                      {normalized.unit} · {formatCurrency(normalized.base_price)}
                    </div>
                    {(normalized.special_offer_note || item.special_offer_note) && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '2px 6px', marginTop: 4, display: 'inline-block' }}>
                        🎁 {normalized.special_offer_note || item.special_offer_note}
                        {(normalized.special_offer_cost ?? item.special_offer_cost) ? ` (Cost ₹${normalized.special_offer_cost ?? item.special_offer_cost})` : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, textAlign: 'center', verticalAlign: 'top' }}>{formatQuantityDisplay(normalized.quantity, normalized.unit, normalized.unit_type)}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, textAlign: 'right', verticalAlign: 'top', color: '#555' }}>{formatCurrency(normalized.base_price)}</td>
                  <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 800, textAlign: 'right', verticalAlign: 'top', color: '#0A0A0A' }}>{formatCurrency(normalized.line_total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── TOTALS ───────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, borderTop: '2px solid #2E7D32', paddingTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 240, width: '100%', maxWidth: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#666' }}>Subtotal</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#1B5E20' }}>
                  Coupon{couponCode ? ` (${couponCode})` : ''}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1B5E20' }}>−{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {manualDiscountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#1B5E20' }}>Manual Discount</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1B5E20' }}>−{formatCurrency(manualDiscountAmount)}</span>
              </div>
            )}
            {gstAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#666' }}>GST</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>+{formatCurrency(gstAmount)}</span>
              </div>
            )}
            {effectiveDelivery > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#666' }}>Delivery</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(effectiveDelivery)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderTop: '2px solid #2E7D32', paddingTop: 10, marginTop: 4,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 900, color: '#0A0A0A', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#0A0A0A' }}>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 32, paddingTop: 16, borderTop: '1px dashed #d0d0d0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.5 }}>Thank You For Shopping With Us</div>
        <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>Follow us on Instagram: @{shopInstagram}</div>
        {onPrintReceipt && (
          <button
            type="button"
            onClick={onPrintReceipt}
            className="print:hidden"
            data-html2canvas-ignore="true"
            style={{
              marginTop: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #2E7D32', borderRadius: 999, padding: '9px 20px',
              background: '#0A0A0A', color: '#2E7D32', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            Print Thermal Receipt
          </button>
        )}
      </div>
    </div>
  )
}
