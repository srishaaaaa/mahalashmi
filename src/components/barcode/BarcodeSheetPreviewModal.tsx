import React, { useEffect, useRef } from 'react'
import { X, Printer } from 'lucide-react'
import {
  type BarcodeQueueItem,
  type LabelSizeConfig,
  renderBarcodeSvg,
} from '../../lib/barcode'

interface BarcodeSheetPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  items: BarcodeQueueItem[]
  sizeConfig: LabelSizeConfig
  onPrint: () => void
}

export const BarcodeSheetPreviewModal: React.FC<BarcodeSheetPreviewModalProps> = ({
  isOpen,
  onClose,
  items,
  sizeConfig,
  onPrint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Expand all selected queue items into individual labels based on `noOfLabels`
  const individualLabels: BarcodeQueueItem[] = []
  items
    .filter((it) => it.selected)
    .forEach((it) => {
      const count = Math.max(1, it.noOfLabels || 1)
      for (let i = 0; i < count; i++) {
        individualLabels.push(it)
      }
    })

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    // Render SVG barcode for each label
    const svgs = containerRef.current.querySelectorAll<SVGSVGElement>('svg.preview-barcode-svg')
    svgs.forEach((svg) => {
      const code = svg.getAttribute('data-barcode')
      if (code) {
        renderBarcodeSvg(svg, code, {
          width: 1.3,
          height: 28,
          fontSize: 10,
          displayValue: false,
          margin: 0,
        })
      }
    })
  }, [isOpen, individualLabels.length])

  if (!isOpen) return null

  const gridColsClass =
    sizeConfig.labelsPerRow === 1
      ? 'grid-cols-1 max-w-sm'
      : sizeConfig.labelsPerRow === 3
      ? 'grid-cols-1 sm:grid-cols-3 max-w-4xl'
      : 'grid-cols-1 sm:grid-cols-2 max-w-2xl'

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#0A0A0A] text-white">
          <div>
            <h3 className="text-base font-black tracking-wide text-white">Preview</h3>
            <p className="text-xs text-[#D4AF37] font-semibold">
              {individualLabels.length} Labels ({sizeConfig.name})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview Sheet Body */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-6 bg-gray-100/70 flex justify-center"
        >
          <div className={`grid gap-4 w-full ${gridColsClass}`}>
            {individualLabels.map((label, idx) => (
              <div
                key={`${label.id}-${idx}`}
                className="bg-white rounded-xl border border-gray-300 p-3 shadow-sm flex flex-col items-center justify-center text-center relative"
                style={{
                  minHeight: '140px',
                }}
              >
                {/* Header */}
                {label.header && (
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 leading-tight">
                    {label.header}
                  </span>
                )}

                {/* Barcode SVG */}
                <div className="my-1 flex items-center justify-center">
                  <svg
                    className="preview-barcode-svg"
                    data-barcode={label.barcodeValue}
                  />
                </div>

                {/* Item Code Number */}
                <span className="text-[10px] font-mono font-bold text-gray-800 tracking-wider">
                  {label.barcodeValue}
                </span>

                {/* Lines */}
                {label.line1 && (
                  <span className="text-[10px] font-bold text-gray-700 truncate max-w-full">
                    {label.line1}
                  </span>
                )}
                {label.line2 && (
                  <span className="text-[9px] font-semibold text-gray-600 truncate max-w-full">
                    {label.line2}
                  </span>
                )}
                {label.line3 && (
                  <span className="text-[9px] font-black text-[#0A0A0A] truncate max-w-full">
                    {label.line3}
                  </span>
                )}
                {label.line4 && (
                  <span className="text-[8px] text-gray-500 truncate max-w-full">
                    {label.line4}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white">
          <span className="text-xs font-bold text-gray-600">
            Total {individualLabels.length} physical stickers ready to print
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onPrint()
              }}
              className="px-6 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] text-xs font-black uppercase tracking-wider hover:bg-[#1A1A1A] transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Printer size={15} /> Print Labels
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
