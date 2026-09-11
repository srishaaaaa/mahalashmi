import React, { useEffect, useRef } from 'react'
import { renderBarcodeSvg } from '../../lib/barcode'
import { BRAND_EN, BRAND_MONOGRAM } from '../../lib/brand'
import { formatCurrency } from '../../lib/retail'

export interface BarcodeLabelProps {
  productName: string
  variantName?: string
  barcodeValue: string
  price: number
  mrp?: number | null
  storeName?: string
  widthMm?: number
  heightMm?: number
}

export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
  productName,
  variantName,
  barcodeValue,
  price,
  mrp,
  storeName = BRAND_EN,
  widthMm = 50,
  heightMm = 30,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current && barcodeValue) {
      renderBarcodeSvg(svgRef.current, barcodeValue, {
        width: widthMm <= 38 ? 0.85 : 0.95,
        height: heightMm <= 25 ? 13 : 16,
        fontSize: 7.5,
        font: 'Arial, sans-serif',
        margin: 0,
        textMargin: 1,
        displayValue: true,
      })
    }
  }, [barcodeValue, widthMm, heightMm])

  const fullTitle = `${productName}${variantName ? ` (${variantName})` : ''}`

  return (
    <div
      className="barcode-sticker-box bg-white text-black border border-gray-300 rounded p-1.5 flex flex-col justify-between items-center text-center shadow-sm select-none"
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        maxWidth: `${widthMm}mm`,
        maxHeight: `${heightMm}mm`,
        padding: '1.2mm 1.8mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Brand & Product Header */}
      <div className="w-full flex flex-col items-center leading-none">
        <div className="text-[9px] font-black tracking-wider text-[#0A0A0A] uppercase truncate max-w-full">
          {storeName}
        </div>
        <div className="text-[8.5px] font-bold text-gray-900 truncate max-w-full mt-0.5 leading-tight">
          {fullTitle}
        </div>
      </div>

      {/* Barcode Graphic Box */}
      <div className="w-full flex-1 flex justify-center items-center my-0.5 overflow-hidden max-h-[15mm]">
        <svg ref={svgRef} className="max-w-[95%] max-h-full h-auto" />
      </div>

      {/* Pricing Footer */}
      <div className="w-full flex items-center justify-between text-[8px] px-0.5 border-t border-black pt-0.5 leading-none">
        {mrp && mrp > price ? (
          <span className="text-gray-500 line-through text-[7.5px]">
            MRP {formatCurrency(mrp)}
          </span>
        ) : (
          <span className="text-gray-600 font-bold text-[7px]">{BRAND_MONOGRAM} RETAIL</span>
        )}
        <span className="font-black text-[10px] text-black">
          {formatCurrency(price)}
        </span>
      </div>
    </div>
  )
}
