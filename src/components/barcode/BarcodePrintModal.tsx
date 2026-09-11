import React, { useState } from 'react'
import { X, Printer, Copy, Check } from 'lucide-react'
import { BarcodeLabel } from './BarcodeLabel'
import { BRAND_EN, BRAND_MONOGRAM } from '../../lib/brand'

export interface BarcodePrintModalProps {
  isOpen: boolean
  onClose: () => void
  productName: string
  variantName?: string
  barcodeValue: string
  price: number
  mrp?: number | null
  defaultQuantity?: number
}

type LabelSizePreset = {
  name: string
  widthMm: number
  heightMm: number
}

const LABEL_PRESETS: LabelSizePreset[] = [
  { name: 'Thermal Standard (50mm × 30mm)', widthMm: 50, heightMm: 30 },
  { name: 'Thermal Compact (50mm × 25mm)', widthMm: 50, heightMm: 25 },
  { name: 'Small Jewelry / Tag (38mm × 25mm)', widthMm: 38, heightMm: 25 },
  { name: 'Large Sticker (60mm × 40mm)', widthMm: 60, heightMm: 40 },
]

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  productName,
  variantName,
  barcodeValue,
  price,
  mrp,
  defaultQuantity = 1,
}) => {
  const [quantity, setQuantity] = useState(defaultQuantity)
  const [selectedPreset, setSelectedPreset] = useState<LabelSizePreset>(LABEL_PRESETS[0])
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcodeValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
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

    const fullTitle = `${productName}${variantName ? ` (${variantName})` : ''}`

    // Build standalone HTML for the printed stickers with strict thermal proportions
    const stickersHtml = Array.from({ length: Math.max(1, quantity) })
      .map(
        () => `
        <div class="sticker">
          <div class="header">
            <div class="brand">${BRAND_EN}</div>
            <div class="prod-title">${fullTitle}</div>
          </div>
          <div class="barcode-box">
            <svg class="barcode-svg" jsbarcode-value="${barcodeValue}"></svg>
          </div>
          <div class="footer">
            <span>${mrp && mrp > price ? `<span class="mrp">MRP ₹${mrp}</span>` : `<span class="retail-tag">${BRAND_MONOGRAM} RETAIL</span>`}</span>
            <span class="price">₹${price}</span>
          </div>
        </div>
      `
      )
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode - ${barcodeValue}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: ${selectedPreset.widthMm}mm ${selectedPreset.heightMm}mm;
              margin: 0mm !important;
              marks: none !important;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${selectedPreset.widthMm}mm !important;
              height: ${selectedPreset.heightMm}mm !important;
              overflow: hidden !important;
              background: #fff !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sticker {
              width: ${selectedPreset.widthMm}mm;
              height: ${selectedPreset.heightMm}mm;
              max-width: ${selectedPreset.widthMm}mm;
              max-height: ${selectedPreset.heightMm}mm;
              padding: 0.8mm 1.5mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden;
              box-sizing: border-box;
            }
            .sticker:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .header {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              line-height: 1;
              padding-bottom: 0.3mm;
            }
            .brand {
              font-size: 7.5pt;
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #000;
              line-height: 1;
            }
            .prod-title {
              font-size: 6.5pt;
              font-weight: 700;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 96%;
              margin-top: 0.4mm;
              color: #111;
              line-height: 1;
            }
            .barcode-box {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 0;
              overflow: hidden;
            }
            .barcode-svg {
              display: block;
              margin: 0 auto;
              max-width: 95%;
              height: auto;
            }
            .footer {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-top: 0.5pt solid #000;
              padding-top: 0.4mm;
              line-height: 1;
              margin-top: 0.2mm;
            }
            .retail-tag {
              font-size: 5.5pt;
              font-weight: 800;
              color: #444;
            }
            .mrp {
              text-decoration: line-through;
              color: #555;
              font-size: 6pt;
              font-weight: 600;
            }
            .price {
              font-size: 8.5pt;
              font-weight: 900;
              color: #000;
            }
          </style>
        </head>
        <body>
          ${stickersHtml}
          <script>
            window.onload = function() {
              JsBarcode(".barcode-svg").init({
                format: "CODE128",
                width: ${selectedPreset.widthMm <= 38 ? 0.85 : 0.95},
                height: ${selectedPreset.heightMm <= 25 ? 13 : 16},
                fontSize: 7.5,
                font: "Arial, sans-serif",
                margin: 0,
                textMargin: 1,
                displayValue: true
              });
              setTimeout(function() {
                window.focus();
                window.print();
              }, 300);
            }
          </script>
        </body>
      </html>
    `

    doc.open()
    doc.write(html)
    doc.close()

    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] border border-[#B7E1BE] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0A0A0A] px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#2E7D32]/30 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1A1A1A] border border-[#2E7D32] flex items-center justify-center text-[#2E7D32]">
              <Printer size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wide text-white">
                Print Barcode Labels ({BRAND_EN})
              </h2>
              <p className="text-[11px] text-[#2E7D32] font-semibold">
                Generate physical retail stickers for this SKU
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body - Scrollable within max-h-[90vh] */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 min-h-0 hide-scrollbar">
          {/* Barcode Info Card */}
          <div className="bg-[#FBFAF6] border border-[#B7E1BE] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#1B5E20]">
                Product / SKU
              </span>
              <h3 className="text-lg font-black text-[#0A0A0A]">{productName}</h3>
              {variantName && (
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                  Variant: {variantName}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
              <span className="font-mono text-sm font-black text-black">
                {barcodeValue}
              </span>
              <button
                type="button"
                onClick={handleCopyBarcode}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 cursor-pointer"
                title="Copy Barcode Value"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                Number of Labels to Print
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-black font-black text-lg flex items-center justify-center border border-gray-300 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center font-black text-lg py-2 rounded-xl border-2 border-[#B7E1BE] bg-[#FBFAF6] focus:border-[#0A0A0A] focus:bg-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-black font-black text-lg flex items-center justify-center border border-gray-300 cursor-pointer"
                >
                  +
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Prints {quantity} physical stickers with identical barcode identifier.
              </p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                Label Sizing Preset
              </label>
              <select
                value={selectedPreset.name}
                onChange={(e) => {
                  const preset = LABEL_PRESETS.find((p) => p.name === e.target.value)
                  if (preset) setSelectedPreset(preset)
                }}
                className="w-full py-2.5 px-3 rounded-xl border-2 border-[#B7E1BE] bg-[#FBFAF6] font-bold text-sm text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white cursor-pointer"
              >
                {LABEL_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-2">
              Sticker Print Preview (1 of {quantity})
            </label>
            <div className="bg-[#FBFAF6] border-2 border-dashed border-[#B7E1BE] rounded-2xl p-6 flex items-center justify-center">
              <BarcodeLabel
                productName={productName}
                variantName={variantName}
                barcodeValue={barcodeValue}
                price={price}
                mrp={mrp}
                storeName={BRAND_EN}
                widthMm={selectedPreset.widthMm}
                heightMm={selectedPreset.heightMm}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#FBFAF6] px-4 py-3 sm:px-6 sm:py-3.5 border-t border-[#B7E1BE] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#2E7D32] text-[#2E7D32] font-black hover:bg-[#1A1A1A] transition-all shadow-md cursor-pointer hover:scale-[1.02]"
          >
            <Printer size={16} />
            Print {quantity} {quantity === 1 ? 'Sticker' : 'Stickers'}
          </button>
        </div>
      </div>
    </div>
  )
}
