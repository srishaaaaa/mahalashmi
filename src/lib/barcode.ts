import JsBarcode from 'jsbarcode'

export interface LabelSizeConfig {
  id: string
  name: string
  labelsPerRow: number
  widthMm: number
  heightMm: number
  horizontalGapMm: number
  isCustom?: boolean
}

export const DEFAULT_LABEL_SIZES: LabelSizeConfig[] = [
  { id: '2_50x25', name: '2 Labels (50×25mm)', labelsPerRow: 2, widthMm: 50, heightMm: 25, horizontalGapMm: 2 },
  { id: '1_100x50', name: '1 Label (100×50mm)', labelsPerRow: 1, widthMm: 100, heightMm: 50, horizontalGapMm: 0 },
  { id: '1_50x25', name: '1 Label (50×25mm)', labelsPerRow: 1, widthMm: 50, heightMm: 25, horizontalGapMm: 0 },
  { id: '2_38x25', name: '2 Labels (38×25mm)', labelsPerRow: 2, widthMm: 38, heightMm: 25, horizontalGapMm: 2 },
]

export interface BarcodeSettings {
  printerType: 'label' | 'regular'
  selectedSizeId: string
  showSalePrice: boolean
  showCompanyName: boolean
  showItemName: boolean
  showDiscount: boolean
}

export const DEFAULT_BARCODE_SETTINGS: BarcodeSettings = {
  printerType: 'label',
  // Must be a labelsPerRow:1 size — printerType 'label' means a single
  // continuous thermal roll, which only ever feeds one label across. Pairing
  // it with a 2-up preset (as this used to default to) sends a 2-column grid
  // to a roll that's only wide enough for one column, producing every other
  // label blank/misaligned.
  selectedSizeId: '1_50x25',
  showSalePrice: true,
  showCompanyName: true,
  showItemName: true,
  showDiscount: false,
}

const SETTINGS_KEY = 'mahalashmi_stores_barcode_settings'
const CUSTOM_SIZES_KEY = 'mahalashmi_stores_custom_label_sizes'

export function getStoredBarcodeSettings(): BarcodeSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_BARCODE_SETTINGS, ...JSON.parse(raw) }
  } catch (e) {
    console.error('Failed to parse barcode settings:', e)
  }
  return DEFAULT_BARCODE_SETTINGS
}

export function saveStoredBarcodeSettings(settings: BarcodeSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save barcode settings:', e)
  }
}

export function getStoredCustomSizes(): LabelSizeConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SIZES_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse custom label sizes:', e)
  }
  return []
}

export function saveStoredCustomSize(size: LabelSizeConfig): LabelSizeConfig[] {
  const existing = getStoredCustomSizes().filter((s) => s.id !== size.id)
  const updated = [...existing, { ...size, isCustom: true }]
  try {
    localStorage.setItem(CUSTOM_SIZES_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Failed to save custom label size:', e)
  }
  return updated
}

export function getAllLabelSizes(): LabelSizeConfig[] {
  return [...DEFAULT_LABEL_SIZES, ...getStoredCustomSizes()]
}

export interface BarcodeQueueItem {
  id: string
  productId: number
  productName: string
  variantId?: string | null
  variantName?: string
  barcodeValue: string
  price: number
  costPrice?: number
  noOfLabels: number
  header: string
  line1: string
  line2: string
  line3: string
  line4: string
  selected: boolean
}

/**
 * Render a CODE128 barcode directly into an SVG element.
 */
export function renderBarcodeSvg(
  svgElement: SVGSVGElement,
  value: string,
  options?: {
    width?: number
    height?: number
    displayValue?: boolean
    fontSize?: number
    font?: string
    textMargin?: number
    margin?: number
    lineColor?: string
    background?: string
  }
) {
  if (!svgElement || !value) return

  try {
    JsBarcode(svgElement, value.trim(), {
      format: 'CODE128',
      width: options?.width ?? 1.5,
      height: options?.height ?? 36,
      displayValue: options?.displayValue ?? true,
      fontSize: options?.fontSize ?? 11,
      font: options?.font ?? 'monospace',
      textMargin: options?.textMargin ?? 1,
      margin: options?.margin ?? 4,
      lineColor: options?.lineColor ?? '#000000',
      background: options?.background ?? '#ffffff',
    })
  } catch (err) {
    console.error('[renderBarcodeSvg] Failed to generate barcode:', err)
  }
}

/**
 * Format barcode for UI display.
 */
export function formatBarcodeDisplay(value?: string | null): string {
  if (!value) return '—'
  return String(value).trim()
}

/**
 * Validate barcode format (alphanumeric, 4 to 32 chars).
 */
export function isValidBarcodeValue(value: string): boolean {
  return /^[A-Z0-9_-]{4,32}$/i.test(value.trim())
}
