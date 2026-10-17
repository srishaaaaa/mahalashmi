import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Check,
  Package,
  Tag,
  Boxes,
  ArrowLeft,
  Pencil,
  Layers,
  Ruler,
  SlidersHorizontal,
  Dices,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProductStore, type Product } from '../../store/store'
import { fetchVariantsByProduct } from '../../services/variantService'
import { inventoryService, type CategoryRecord } from '../../services/inventoryService'
import { useSound } from '../../context/SoundContext'
import { getErrorMessage } from '../../lib/errorMessage'
import { normalizeBarcode } from '../../lib/barcode'
import { roundTo } from '../../lib/retail'
import { UNIT_OPTIONS, findUnitOption } from '../../lib/units'
import { DateInputDDMMYYYY } from '../DateInputDDMMYYYY'
import { UnitSelect } from './UnitSelect'
import { defaultLowStockThreshold } from '../../lib/stockLevels'

// Makes the shared date input match the other fields in this form (height, padding,
// background, text size); `!` is needed to beat the component's own defaults.
const DATE_INPUT_CLASS = '!h-10 !py-0 !pl-3.5 !pr-10 !text-xs !bg-[#FAFAFA]'

export interface VariantInputRow {
  id: string
  qty: string
  unit?: string
  price: number
  costPrice: number
  stock: number
  customBarcode?: string
  /** YYYY-MM-DD; each pack size can have its own batch dates */
  mfgDate?: string
  expiryDate?: string
}

// Unsaved product form, kept in this browser so a refresh or moving to another
// page does not lose what was typed. New products use one draft; each existing
// product being edited gets its own. Cleared on save/update or Cancel.
const NEW_PRODUCT_DRAFT_KEY = 'mahalashmi_new_product_draft_v1'
const EDIT_PRODUCT_DRAFT_PREFIX = 'mahalashmi_edit_product_draft_v1_'
// Product whose edit form had unsaved changes, so it reopens after a refresh.
const LAST_EDITED_PRODUCT_KEY = 'mahalashmi_last_edited_product_v1'

type NewProductDraft = {
  name: string; nameTa: string; categoryId: number | ''; price: string; purchasePrice: string
  unitChoice: string; customUnitLabel: string; contentSize: string; contentUnit: string
  stockQuantity: string; lowStockAlert: string; expiryDate: string; mfgDate: string
  location: string; barcode: string; description: string; hasVariants: boolean; soldByWeight: boolean
  hasSpecialOffer: boolean; specialOfferNote: string; specialOfferCost: string; variantRows: VariantInputRow[]
}

const readDraft = (key: string): Partial<NewProductDraft> | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as Partial<NewProductDraft> : null
  } catch { return null }
}
const loadNewProductDraft = () => readDraft(NEW_PRODUCT_DRAFT_KEY)
const editDraftKey = (productId: number) => `${EDIT_PRODUCT_DRAFT_PREFIX}${productId}`
const storageRemove = (key: string) => { try { localStorage.removeItem(key) } catch { /* ignore */ } }
const storageSet = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* ignore */ } }
const readLastEditedProductId = (): number | null => {
  try {
    const id = Number(localStorage.getItem(LAST_EDITED_PRODUCT_KEY))
    return Number.isFinite(id) && id > 0 && readDraft(editDraftKey(id)) ? id : null
  } catch { return null }
}

const isBlankDraft = (d: NewProductDraft) =>
  !d.name.trim() && !d.nameTa.trim() && d.categoryId === '' && !d.price && !d.purchasePrice &&
  !d.barcode.trim() && !d.description.trim() && !d.location.trim() && !d.expiryDate && !d.mfgDate &&
  !d.specialOfferNote.trim() && !d.specialOfferCost && d.variantRows.length === 0 &&
  (d.stockQuantity === '0' || d.stockQuantity === '') && !d.hasVariants && !d.hasSpecialOffer

/** Saves a pack size's batch dates. Works before the mfg_date column exists (then saves expiry only). */
async function saveVariantDates(variantId: string, row: VariantInputRow) {
  const expiry_date = row.expiryDate || null
  const mfg_date = row.mfgDate || null
  const { error } = await supabase.from('product_variants').update({ expiry_date, mfg_date }).eq('id', variantId)
  if (error && /mfg_date/i.test(error.message || '')) {
    await supabase.from('product_variants').update({ expiry_date }).eq('id', variantId)
  } else if (error) {
    console.error('[AddEditProductView] saving pack size dates failed:', error)
  }
}

/** Loads batch dates for pack sizes (falls back to expiry only before mfg_date exists). */
async function loadVariantDates(productId: string): Promise<Map<string, { mfgDate: string; expiryDate: string }>> {
  const out = new Map<string, { mfgDate: string; expiryDate: string }>()
  let res = await supabase.from('product_variants').select('id, expiry_date, mfg_date').eq('product_id', productId)
  if (res.error) res = await supabase.from('product_variants').select('id, expiry_date').eq('product_id', productId) as typeof res
  for (const r of (res.data || []) as Array<{ id: string; expiry_date?: string | null; mfg_date?: string | null }>) {
    out.set(String(r.id), { mfgDate: String(r.mfg_date || '').slice(0, 10), expiryDate: String(r.expiry_date || '').slice(0, 10) })
  }
  return out
}

// Extracts the quantity and unit from a stored size label (e.g. "200gm" -> qty: "200", unit: "gm")
const parseQtyAndUnitFromLabel = (label?: string | null, fallbackUnit?: string): { qty: string; unit: string } => {
  if (!label) return { qty: '', unit: fallbackUnit || 'gm' }
  const match = label.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (match) {
    return { qty: match[1], unit: match[2]?.trim() || fallbackUnit || 'gm' }
  }
  return { qty: label.trim(), unit: fallbackUnit || 'gm' }
}

// The actual barcode_registry writes below use `.upsert(..., { onConflict: 'barcode_value' })`,
// which silently reassigns a barcode to the new owner instead of raising a unique-constraint
// error. This pre-flight check is the only thing that actually blocks reusing a barcode that
// already belongs to a different product/variant.
async function isBarcodeConflict(
  normalizedValue: string,
  owner: { productId: number | null; variantId?: string | null }
): Promise<boolean> {
  if (!normalizedValue) return false
  const { data } = await supabase
    .from('barcode_registry')
    .select('product_id, variant_id')
    .ilike('barcode_value', normalizedValue)
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return false
  if (owner.variantId) return data.variant_id !== owner.variantId
  return !(data.variant_id === null && data.product_id === owner.productId)
}

export const AddEditProductView: React.FC<{ onStockUpdated?: () => void }> = ({ onStockUpdated }) => {
  const { products, fetchProducts } = useProductStore()
  const { play } = useSound()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [draft] = useState(loadNewProductDraft)
  const [mobileView, setMobileView] = useState<'catalog' | 'form'>(() => (draft || readLastEditedProductId() ? 'form' : 'catalog'))
  // The product's saved values as loaded into the edit form; an edit draft is
  // only kept while the form differs from these.
  const editBaselineRef = useRef<{ id: number; json: string } | null>(null)
  const [pendingReopenId, setPendingReopenId] = useState<number | null>(readLastEditedProductId)

  // Form State
  const [name, setName] = useState(draft?.name ?? '')
  const [nameTa, setNameTa] = useState(draft?.nameTa ?? '')
  const [categoryId, setCategoryId] = useState<number | ''>(draft?.categoryId ?? '')
  const [price, setPrice] = useState<string>(draft?.price ?? '')
  const [purchasePrice, setPurchasePrice] = useState<string>(draft?.purchasePrice ?? '')
  const [unitChoice, setUnitChoice] = useState<string>(draft?.unitChoice ?? 'pcs')
  const [customUnitLabel, setCustomUnitLabel] = useState<string>(draft?.customUnitLabel ?? '')
  const [contentSize, setContentSize] = useState<string>(draft?.contentSize ?? '') // e.g. "200ml", "500g" for packets
  const [contentUnit, setContentUnit] = useState<string>(draft?.contentUnit ?? '') // e.g. "ml", "g"
  const [stockQuantity, setStockQuantity] = useState<string>(draft?.stockQuantity ?? '0')
  const [lowStockAlert, setLowStockAlert] = useState<string>(() => draft?.lowStockAlert ?? String(defaultLowStockThreshold()))
  const [expiryDate, setExpiryDate] = useState<string>(draft?.expiryDate ?? '')
  const [mfgDate, setMfgDate] = useState<string>(draft?.mfgDate ?? '')
  const [location, setLocation] = useState<string>(draft?.location ?? '')
  const [barcode, setBarcode] = useState<string>(draft?.barcode ?? '')
  const [description, setDescription] = useState<string>(draft?.description ?? '')
  const [hasVariants, setHasVariants] = useState<boolean>(draft?.hasVariants ?? false)
  const [soldByWeight, setSoldByWeight] = useState<boolean>(draft?.soldByWeight ?? false)
  const [hasSpecialOffer, setHasSpecialOffer] = useState<boolean>(draft?.hasSpecialOffer ?? false)
  const [specialOfferNote, setSpecialOfferNote] = useState<string>(draft?.specialOfferNote ?? '')
  const [specialOfferCost, setSpecialOfferCost] = useState<string>(draft?.specialOfferCost ?? '')

  // Variants Rows for dynamic addition
  const [variantRows, setVariantRows] = useState<VariantInputRow[]>(Array.isArray(draft?.variantRows) ? draft.variantRows : [])

  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Resolves the active unit choice to concrete DB fields + a short display suffix
  // (e.g. "gm", "kg"), handling the custom "Other" unit the owner typed in themselves.
  const getSelectedUnitInfo = () => {
    const preset = UNIT_OPTIONS.find((o) => o.value === unitChoice) || UNIT_OPTIONS[0]
    if (unitChoice === 'custom') {
      const custom = customUnitLabel.trim() || 'unit'
      return { unitType: 'unit' as const, unit: custom.toLowerCase(), suffix: custom }
    }
    return { unitType: preset.unitType, unit: preset.unit, suffix: preset.suffix }
  }

  const generateRandomDates = () => {
    const today = new Date()

    const mfgDaysAgo = Math.floor(Math.random() * 30) + 1
    const mfgDate = new Date(today)
    mfgDate.setDate(mfgDate.getDate() - mfgDaysAgo)
    const mfgFormatted = `${mfgDate.getFullYear()}-${String(mfgDate.getMonth() + 1).padStart(2, '0')}-${String(mfgDate.getDate()).padStart(2, '0')}`

    const expiryDaysFromToday = Math.floor(Math.random() * 335) + 30
    const expiryDate = new Date(today)
    expiryDate.setDate(expiryDate.getDate() + expiryDaysFromToday)
    const expiryFormatted = `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}`

    setMfgDate(mfgFormatted)
    setExpiryDate(expiryFormatted)
  }

  useEffect(() => {
    void fetchProducts()
    inventoryService.fetchCategories().then(setCategories).catch(console.error)
  }, [fetchProducts])

  // Keep the form as a draft while it is being filled in.
  useEffect(() => {
    const current: NewProductDraft = {
      name, nameTa, categoryId, price, purchasePrice, unitChoice, customUnitLabel, contentSize, contentUnit,
      stockQuantity, lowStockAlert, expiryDate, mfgDate, location, barcode, description, hasVariants,
      soldByWeight, hasSpecialOffer, specialOfferNote, specialOfferCost, variantRows,
    }
    if (selectedProductId === null) {
      if (isBlankDraft(current)) storageRemove(NEW_PRODUCT_DRAFT_KEY)
      else storageSet(NEW_PRODUCT_DRAFT_KEY, JSON.stringify(current))
      return
    }
    const baseline = editBaselineRef.current
    if (!baseline || baseline.id !== selectedProductId) return // product still loading
    const json = JSON.stringify(current)
    if (json === baseline.json) {
      storageRemove(editDraftKey(selectedProductId))
      storageRemove(LAST_EDITED_PRODUCT_KEY)
    } else {
      storageSet(editDraftKey(selectedProductId), json)
      storageSet(LAST_EDITED_PRODUCT_KEY, String(selectedProductId))
    }
  }, [selectedProductId, name, nameTa, categoryId, price, purchasePrice, unitChoice, customUnitLabel, contentSize,
    contentUnit, stockQuantity, lowStockAlert, expiryDate, mfgDate, location, barcode, description, hasVariants,
    soldByWeight, hasSpecialOffer, specialOfferNote, specialOfferCost, variantRows])

  const applyFormValues = (v: Partial<NewProductDraft>) => {
    if (v.name !== undefined) setName(v.name)
    if (v.nameTa !== undefined) setNameTa(v.nameTa)
    if (v.categoryId !== undefined) setCategoryId(v.categoryId)
    if (v.price !== undefined) setPrice(v.price)
    if (v.purchasePrice !== undefined) setPurchasePrice(v.purchasePrice)
    if (v.unitChoice !== undefined) setUnitChoice(v.unitChoice)
    if (v.customUnitLabel !== undefined) setCustomUnitLabel(v.customUnitLabel)
    if (v.contentSize !== undefined) setContentSize(v.contentSize)
    if (v.contentUnit !== undefined) setContentUnit(v.contentUnit)
    if (v.stockQuantity !== undefined) setStockQuantity(v.stockQuantity)
    if (v.lowStockAlert !== undefined) setLowStockAlert(v.lowStockAlert)
    if (v.expiryDate !== undefined) setExpiryDate(v.expiryDate)
    if (v.mfgDate !== undefined) setMfgDate(v.mfgDate)
    if (v.location !== undefined) setLocation(v.location)
    if (v.barcode !== undefined) setBarcode(v.barcode)
    if (v.description !== undefined) setDescription(v.description)
    if (v.hasVariants !== undefined) setHasVariants(v.hasVariants)
    if (v.soldByWeight !== undefined) setSoldByWeight(v.soldByWeight)
    if (v.hasSpecialOffer !== undefined) setHasSpecialOffer(v.hasSpecialOffer)
    if (v.specialOfferNote !== undefined) setSpecialOfferNote(v.specialOfferNote)
    if (v.specialOfferCost !== undefined) setSpecialOfferCost(v.specialOfferCost)
    if (Array.isArray(v.variantRows)) setVariantRows(v.variantRows)
  }

  /** Clears the form (Cancel, or after saving) and drops its draft. Leaving an
   *  edit goes back to a new product, restoring any unfinished new-product draft. */
  const resetForm = () => {
    const leavingEdit = selectedProductId !== null
    if (leavingEdit) {
      storageRemove(editDraftKey(selectedProductId))
      storageRemove(LAST_EDITED_PRODUCT_KEY)
    } else {
      storageRemove(NEW_PRODUCT_DRAFT_KEY)
    }
    editBaselineRef.current = null
    setSelectedProductId(null)
    setName('')
    setNameTa('')
    setCategoryId('')
    setPrice('')
    setPurchasePrice('')
    setUnitChoice('pcs')
    setCustomUnitLabel('')
    setContentSize('')
    setContentUnit('')
    setStockQuantity('0')
    setLowStockAlert(String(defaultLowStockThreshold()))
    setExpiryDate('')
    setMfgDate('')
    setLocation('')
    setBarcode('')
    setDescription('')
    setHasVariants(false)
    setSoldByWeight(false)
    setHasSpecialOffer(false)
    setSpecialOfferNote('')
    setSpecialOfferCost('')
    setVariantRows([])
    setStatusMessage(null)
    const newDraft = leavingEdit ? loadNewProductDraft() : null
    if (newDraft) applyFormValues(newDraft)
  }

  const startEditProduct = async (p: Product) => {
    editBaselineRef.current = null
    setMobileView('form')
    setSelectedProductId(Number(p.id))
    setName(p.name || '')
    setNameTa(p.nameTa || (p as unknown as { name_ta?: string }).name_ta || '')
    setCategoryId(p.categoryId ? Number(p.categoryId) : '')
    setPrice(String(p.price || ''))
    setPurchasePrice(String(p.purchasePrice || ''))
    const matchedUnit = findUnitOption(p.unitType || 'unit', p.unitLabel || 'piece')
    if (matchedUnit) {
      setUnitChoice(matchedUnit.value)
      setCustomUnitLabel('')
    } else {
      setUnitChoice('custom')
      setCustomUnitLabel(p.unitLabel || '')
    }
    setStockQuantity(String(p.stockQuantity ?? p.stock ?? 0))
    setLowStockAlert(p.lowStockAlert ? String(p.lowStockAlert) : String(defaultLowStockThreshold()))
    setExpiryDate(p.expiryDate || '')
    setMfgDate(p.mfgDate || '')
    setLocation(p.location || '')
    setBarcode(p.barcode || '')
    setDescription(p.description || '')
    setHasVariants(Boolean(p.hasVariants))
    setSoldByWeight(Boolean(p.allowDecimalQuantity))
    setHasSpecialOffer(Boolean(p.hasSpecialOffer))
    setSpecialOfferNote(p.specialOfferNote || '')
    setSpecialOfferCost(p.specialOfferCost != null ? String(p.specialOfferCost) : '')
    setStatusMessage(null)

    let loadedRows: VariantInputRow[] = []
    if (p.hasVariants) {
      try {
        const [vars, dates] = await Promise.all([fetchVariantsByProduct(String(p.id)), loadVariantDates(String(p.id))])
        const defaultUnit = matchedUnit?.suffix || 'gm'
        loadedRows = (
          vars.map((v) => {
            const parsed = parseQtyAndUnitFromLabel(v.sizeLabel || v.variantName, defaultUnit)
            return {
              id: v.id,
              qty: parsed.qty,
              unit: parsed.unit,
              price: v.price,
              costPrice: v.purchasePrice || 0,
              stock: v.stock || 0,
              customBarcode: v.barcode || '',
              mfgDate: dates.get(String(v.id))?.mfgDate || '',
              expiryDate: dates.get(String(v.id))?.expiryDate || '',
            }
          })
        )
      } catch (err) {
        console.error('Failed to load variants for edit:', err)
      }
    }
    setVariantRows(loadedRows)

    // Remember the saved values, then bring back any unsaved edits for this product.
    const id = Number(p.id)
    const loaded: NewProductDraft = {
      name: p.name || '',
      nameTa: p.nameTa || (p as unknown as { name_ta?: string }).name_ta || '',
      categoryId: p.categoryId ? Number(p.categoryId) : '',
      price: String(p.price || ''),
      purchasePrice: String(p.purchasePrice || ''),
      unitChoice: matchedUnit ? matchedUnit.value : 'custom',
      customUnitLabel: matchedUnit ? '' : (p.unitLabel || ''),
      contentSize,
      contentUnit,
      stockQuantity: String(p.stockQuantity ?? p.stock ?? 0),
      lowStockAlert: p.lowStockAlert ? String(p.lowStockAlert) : String(defaultLowStockThreshold()),
      expiryDate: p.expiryDate || '',
      mfgDate: p.mfgDate || '',
      location: p.location || '',
      barcode: p.barcode || '',
      description: p.description || '',
      hasVariants: Boolean(p.hasVariants),
      soldByWeight: Boolean(p.allowDecimalQuantity),
      hasSpecialOffer: Boolean(p.hasSpecialOffer),
      specialOfferNote: p.specialOfferNote || '',
      specialOfferCost: p.specialOfferCost != null ? String(p.specialOfferCost) : '',
      variantRows: loadedRows,
    }
    editBaselineRef.current = { id, json: JSON.stringify(loaded) }
    const saved = readDraft(editDraftKey(id))
    if (saved) {
      applyFormValues(saved)
      setStatusMessage({ type: 'success', text: 'Restored your unsaved changes. Click Update Product to save them, or Cancel to discard.' })
    }
  }

  // After a refresh, reopen the product whose edits were not saved yet.
  useEffect(() => {
    if (pendingReopenId === null || products.length === 0) return
    const product = products.find((item) => Number(item.id) === pendingReopenId)
    setPendingReopenId(null)
    if (product) void startEditProduct(product)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReopenId, products])

  const handleAddVariantRow = () => {
    const baseP = parseFloat(price) || 0
    const baseC = parseFloat(purchasePrice) || 0
    const currentUnit = getSelectedUnitInfo()
    setVariantRows((prev) => [
      ...prev,
      {
        id: `var_${Date.now()}_${Math.random()}`,
        qty: '',
        unit: currentUnit.suffix || 'gm',
        price: baseP,
        costPrice: baseC,
        stock: 0,
        customBarcode: '',
        mfgDate: '',
        expiryDate: '',
      },
    ])
  }

  const handleRemoveVariantRow = (id: string) => {
    setVariantRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleUpdateVariantRow = (
    id: string,
    field: keyof VariantInputRow,
    value: string | number
  ) => {
    setVariantRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  const handleDeleteProduct = async (id: number, prodName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${prodName}" from catalog & inventory?`)) {
      return
    }

    try {
      setLoading(true)
      await inventoryService.deleteInventoryItem(id)
      await fetchProducts(true)
      resetForm()
      setMobileView('catalog')
      onStockUpdated?.()
      play('success')
      setStatusMessage({ type: 'success', text: `Product "${prodName}" deleted successfully.` })
    } catch (err) {
      console.error('Failed to delete product:', err)
      play('error')
      setStatusMessage({ type: 'error', text: getErrorMessage(err, 'Failed to delete product') })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMessage(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setStatusMessage({ type: 'error', text: 'Product Name is required' })
      return
    }

    if (unitChoice === 'custom' && !customUnitLabel.trim()) {
      setStatusMessage({ type: 'error', text: 'Please type the custom unit name, or pick one from the list.' })
      return
    }

    const selectedUnit = getSelectedUnitInfo()
    const labelForQty = (v: VariantInputRow) => `${v.qty.trim()}${v.unit || selectedUnit.suffix}`

    const firstVariant = variantRows.find((v) => v.qty.trim())
    // With pack sizes, the product carries the earliest batch dates so Expiry Alerts flags it in time
    const earliest = (dates: Array<string | undefined>) => dates.filter(Boolean).sort()[0] || ''
    const productExpiry = hasVariants ? earliest(variantRows.map((v) => v.expiryDate)) || expiryDate : expiryDate
    const productMfg = hasVariants ? earliest(variantRows.map((v) => v.mfgDate)) || mfgDate : mfgDate
    const priceNum = hasVariants && firstVariant ? (Number(firstVariant.price) || 0) : (parseFloat(price) || 0)
    const costNum = hasVariants && firstVariant ? (Number(firstVariant.costPrice) || 0) : (parseFloat(purchasePrice) || 0)

    if (!hasVariants && priceNum <= 0) {
      setStatusMessage({ type: 'error', text: 'Price must be greater than 0' })
      return
    }

    if (hasVariants && (!variantRows.length || variantRows.some((v) => !v.qty.trim() || Number(v.qty) <= 0))) {
      setStatusMessage({ type: 'error', text: 'Please provide a quantity for all added pack sizes' })
      return
    }

    const selectedCat = categories.find((c) => Number(c.id) === Number(categoryId))
    const categoryName = selectedCat ? selectedCat.name_en : 'General'
    const alertThreshold = Number(lowStockAlert) > 0 ? Number(lowStockAlert) : 5

    // Block reusing a barcode that already belongs to a different product/variant.
    if (!hasVariants) {
      const normalized = normalizeBarcode(barcode)
      if (normalized && await isBarcodeConflict(normalized, { productId: selectedProductId })) {
        setStatusMessage({ type: 'error', text: 'This barcode is already registered to another item.' })
        return
      }
    } else {
      const seen = new Set<string>()
      for (const v of variantRows) {
        const normalized = normalizeBarcode(v.customBarcode)
        if (!normalized) continue
        if (seen.has(normalized)) {
          setStatusMessage({ type: 'error', text: `Barcode "${normalized}" is used more than once in this product's pack sizes.` })
          return
        }
        seen.add(normalized)
        const ownerVariantId = v.id.startsWith('var_') ? null : v.id
        if (await isBarcodeConflict(normalized, { productId: selectedProductId, variantId: ownerVariantId })) {
          setStatusMessage({ type: 'error', text: `Barcode "${normalized}" is already registered to another item.` })
          return
        }
      }
    }

    setLoading(true)

    try {
      if (selectedProductId) {
        // UPDATE EXISTING PRODUCT
        if (!hasVariants) {
          const inputStock = soldByWeight
            ? Math.max(0, roundTo(parseFloat(stockQuantity) || 0, 3))
            : Math.max(0, parseInt(stockQuantity) || 0)

          // Check previous stock
          const { data: currentProd } = await supabase
            .from('products')
            .select('stock_quantity, stock')
            .eq('id', selectedProductId)
            .single()

          const prevStock = currentProd ? (currentProd.stock_quantity ?? currentProd.stock ?? 0) : 0
          const delta = inputStock - prevStock

          const { error: updErr } = await supabase
            .from('products')
            .update({
              name: trimmedName,
              name_ta: nameTa.trim() || null,
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              unit_type: selectedUnit.unitType,
              unit_label: selectedUnit.unit,
              unit: selectedUnit.unit,
              low_stock_alert: alertThreshold,
              expiry_date: productExpiry || null,
              mfg_date: productMfg || null,
              location: location.trim() || null,
              barcode: barcode.trim() || null,
              description: description.trim() || '',
              has_variants: false,
              allow_decimal_quantity: soldByWeight,
              has_special_offer: hasSpecialOffer,
              special_offer_note: specialOfferNote.trim(),
              special_offer_cost: hasSpecialOffer ? (Number(specialOfferCost) || 0) : 0,
              stock_quantity: inputStock,
              stock: Math.floor(inputStock),
            })
            .eq('id', selectedProductId)

          if (updErr) throw updErr

          if (delta !== 0) {
            await supabase.from('inventory_movements').insert({
              product_id: selectedProductId,
              variant_id: null,
              movement_type: delta > 0 ? 'RESTOCK' : 'CORRECTION',
              quantity_delta: delta,
              quantity_before: prevStock,
              quantity_after: inputStock,
              unit_cost: costNum || null,
              reference_type: 'PRODUCT_UPDATE',
              note: 'Stock updated in product editor',
              created_by_name: 'Admin',
            })
          }

          if (normalizeBarcode(barcode)) {
            const newBarcodeValue = normalizeBarcode(barcode)
            // Retire any old registry entry for this product under a different barcode
            // value, so a since-changed sticker stops scanning and its old code can be reused.
            await supabase.from('barcode_registry')
              .update({ is_active: false })
              .eq('product_id', selectedProductId)
              .is('variant_id', null)
              .neq('barcode_value', newBarcodeValue)

            const { error: regErr } = await supabase.from('barcode_registry').upsert(
              {
                barcode_value: newBarcodeValue,
                entity_type: 'product',
                product_id: selectedProductId,
                variant_id: null,
                is_active: true,
              },
              { onConflict: 'barcode_value' }
            )
            if (regErr) console.error('[AddEditProductView] barcode_registry upsert failed:', regErr)
          }

          play('success')
          setStatusMessage({
            type: 'success',
            text: `Product "${trimmedName}" updated successfully with ${inputStock} stock units! Ready in POS Catalog.`,
          })
        } else {
          // Multi-variant update
          let totalVariantStock = 0
          for (const v of variantRows) {
            if (!v.qty.trim()) continue
            const vLabel = labelForQty(v)
            const vPrice = Number(v.price) > 0 ? Number(v.price) : priceNum
            const vCost = Number(v.costPrice) > 0 ? Number(v.costPrice) : costNum
            const vStock = Math.max(0, Number(v.stock) || 0)
            totalVariantStock += vStock

            if (v.id.startsWith('var_')) {
              // Insert new variant
              const { data: createdVar, error: vErr } = await supabase
                .from('product_variants')
                .insert({
                  product_id: selectedProductId,
                  variant_name: vLabel,
                  size_label: vLabel,
                  price: vPrice,
                  purchase_price: vCost,
                  stock: vStock,
                  barcode: v.customBarcode?.trim() || null,
                  is_active: true,
                })
                .select()
                .single()

              if (!vErr && createdVar) {
                await saveVariantDates(String(createdVar.id), v)
                if (normalizeBarcode(v.customBarcode)) {
                  const { error: regErr } = await supabase.from('barcode_registry').upsert(
                    {
                      barcode_value: normalizeBarcode(v.customBarcode),
                      entity_type: 'variant',
                      product_id: selectedProductId,
                      variant_id: createdVar.id,
                      is_active: true,
                    },
                    { onConflict: 'barcode_value' }
                  )
                  if (regErr) console.error('[AddEditProductView] barcode_registry upsert failed:', regErr)
                }

                if (vStock > 0) {
                  await supabase.from('inventory_movements').insert({
                    product_id: selectedProductId,
                    variant_id: createdVar.id,
                    movement_type: 'RESTOCK',
                    quantity_delta: vStock,
                    quantity_before: 0,
                    quantity_after: vStock,
                    unit_cost: vCost || null,
                    reference_type: 'PRODUCT_UPDATE',
                    note: `Added pack size ${vLabel} with stock`,
                    created_by_name: 'Admin',
                  })
                }
              }
            } else {
              // Update existing variant
              const { data: curVar } = await supabase
                .from('product_variants')
                .select('stock')
                .eq('id', v.id)
                .single()

              const prevVarStock = curVar?.stock ?? 0
              const varDelta = vStock - prevVarStock

              await supabase
                .from('product_variants')
                .update({
                  variant_name: vLabel,
                  size_label: vLabel,
                  price: vPrice,
                  purchase_price: vCost,
                  stock: vStock,
                  barcode: v.customBarcode?.trim() || null,
                })
                .eq('id', v.id)
              await saveVariantDates(v.id, v)

              if (normalizeBarcode(v.customBarcode)) {
                const newVariantBarcodeValue = normalizeBarcode(v.customBarcode)
                // Retire any old registry entry for this pack size under a different barcode
                // value, so a since-changed sticker stops scanning and its old code can be reused.
                await supabase.from('barcode_registry')
                  .update({ is_active: false })
                  .eq('variant_id', v.id)
                  .neq('barcode_value', newVariantBarcodeValue)

                const { error: regErr } = await supabase.from('barcode_registry').upsert(
                  {
                    barcode_value: newVariantBarcodeValue,
                    entity_type: 'variant',
                    product_id: selectedProductId,
                    variant_id: v.id,
                    is_active: true,
                  },
                  { onConflict: 'barcode_value' }
                )
                if (regErr) console.error('[AddEditProductView] barcode_registry upsert failed:', regErr)
              }

              if (varDelta !== 0) {
                await supabase.from('inventory_movements').insert({
                  product_id: selectedProductId,
                  variant_id: v.id,
                  movement_type: varDelta > 0 ? 'RESTOCK' : 'CORRECTION',
                  quantity_delta: varDelta,
                  quantity_before: prevVarStock,
                  quantity_after: vStock,
                  unit_cost: vCost || null,
                  reference_type: 'PRODUCT_UPDATE',
                  note: `Stock updated for pack size ${vLabel}`,
                  created_by_name: 'Admin',
                })
              }
            }
          }

          // Update parent product
          await supabase
            .from('products')
            .update({
              name: trimmedName,
              name_ta: nameTa.trim() || null,
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              unit_type: selectedUnit.unitType,
              unit_label: selectedUnit.unit,
              unit: selectedUnit.unit,
              low_stock_alert: alertThreshold,
              expiry_date: productExpiry || null,
              mfg_date: productMfg || null,
              location: location.trim() || null,
              barcode: null,
              description: description.trim() || '',
              has_variants: true,
              allow_decimal_quantity: false,
              has_special_offer: hasSpecialOffer,
              special_offer_note: specialOfferNote.trim(),
              special_offer_cost: hasSpecialOffer ? (Number(specialOfferCost) || 0) : 0,
              stock_quantity: totalVariantStock,
              stock: totalVariantStock,
            })
            .eq('id', selectedProductId)

          play('success')
          setStatusMessage({
            type: 'success',
            text: `Product "${trimmedName}" updated with ${totalVariantStock} total stock units across all pack sizes! Ready in POS Catalog.`,
          })
        }
      } else {
        // CREATE NEW PRODUCT
        if (!hasVariants) {
          const inputStock = soldByWeight
            ? Math.max(0, roundTo(parseFloat(stockQuantity) || 0, 3))
            : Math.max(0, parseInt(stockQuantity) || 0)

          const { data: newProd, error: insErr } = await supabase
            .from('products')
            .insert({
              name: trimmedName,
              name_ta: nameTa.trim() || null,
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              unit_type: selectedUnit.unitType,
              unit_label: selectedUnit.unit,
              unit: selectedUnit.unit,
              low_stock_alert: alertThreshold,
              expiry_date: productExpiry || null,
              mfg_date: productMfg || null,
              location: location.trim() || null,
              barcode: barcode.trim() || null,
              description: description.trim() || '',
              has_variants: false,
              allow_decimal_quantity: soldByWeight,
              has_special_offer: hasSpecialOffer,
              special_offer_note: specialOfferNote.trim(),
              special_offer_cost: hasSpecialOffer ? (Number(specialOfferCost) || 0) : 0,
              stock_quantity: inputStock,
              stock: Math.floor(inputStock),
              is_active: true,
            })
            .select('id, name')
            .single()

          if (insErr || !newProd) throw insErr || new Error('Failed to create product')

          if (normalizeBarcode(barcode)) {
            const { error: regErr } = await supabase.from('barcode_registry').upsert(
              {
                barcode_value: normalizeBarcode(barcode),
                entity_type: 'product',
                product_id: newProd.id,
                variant_id: null,
                is_active: true,
              },
              { onConflict: 'barcode_value' }
            )
            if (regErr) console.error('[AddEditProductView] barcode_registry upsert failed:', regErr)
          }

          if (inputStock > 0) {
            await supabase.from('inventory_movements').insert({
              product_id: newProd.id,
              variant_id: null,
              movement_type: 'RESTOCK',
              quantity_delta: inputStock,
              quantity_before: 0,
              quantity_after: inputStock,
              unit_cost: costNum || null,
              reference_type: 'PRODUCT_CREATION',
              note: 'Initial received stock on product creation',
              created_by_name: 'Admin',
            })
          }

          play('success')
          resetForm()
          setStatusMessage({
            type: 'success',
            text: `Product "${trimmedName}" created with ${inputStock} stock units! Immediately ready in catalog & billing.`,
          })
        } else {
          // Multi pack-size creation
          let totalVariantStock = 0
          variantRows.forEach((v) => {
            if (v.qty.trim()) {
              totalVariantStock += Math.max(0, Number(v.stock) || 0)
            }
          })

          const { data: newProd, error: insErr } = await supabase
            .from('products')
            .insert({
              name: trimmedName,
              name_ta: nameTa.trim() || null,
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              unit_type: selectedUnit.unitType,
              unit_label: selectedUnit.unit,
              unit: selectedUnit.unit,
              low_stock_alert: alertThreshold,
              expiry_date: productExpiry || null,
              mfg_date: productMfg || null,
              location: location.trim() || null,
              barcode: null,
              description: description.trim() || '',
              has_variants: true,
              allow_decimal_quantity: false,
              has_special_offer: hasSpecialOffer,
              special_offer_note: specialOfferNote.trim(),
              special_offer_cost: hasSpecialOffer ? (Number(specialOfferCost) || 0) : 0,
              stock_quantity: totalVariantStock,
              stock: totalVariantStock,
              is_active: true,
            })
            .select('id, name')
            .single()

          if (insErr || !newProd) throw insErr || new Error('Failed to create product')

          for (const v of variantRows) {
            if (!v.qty.trim()) continue
            const vLabel = labelForQty(v)
            const vPrice = Number(v.price) > 0 ? Number(v.price) : priceNum
            const vCost = Number(v.costPrice) > 0 ? Number(v.costPrice) : costNum
            const vStock = Math.max(0, Number(v.stock) || 0)

            const { data: createdVar } = await supabase
              .from('product_variants')
              .insert({
                product_id: newProd.id,
                variant_name: vLabel,
                size_label: vLabel,
                price: vPrice,
                purchase_price: vCost,
                stock: vStock,
                barcode: v.customBarcode?.trim() ? normalizeBarcode(v.customBarcode) : null,
                is_active: true,
              })
              .select('id')
              .single()
            if (createdVar) await saveVariantDates(String(createdVar.id), v)

            if (createdVar && normalizeBarcode(v.customBarcode)) {
              const { error: regErr } = await supabase.from('barcode_registry').upsert(
                {
                  barcode_value: normalizeBarcode(v.customBarcode),
                  entity_type: 'variant',
                  product_id: newProd.id,
                  variant_id: createdVar.id,
                  is_active: true,
                },
                { onConflict: 'barcode_value' }
              )
              if (regErr) console.error('[AddEditProductView] barcode_registry upsert failed:', regErr)
            }

            if (createdVar && vStock > 0) {
              await supabase.from('inventory_movements').insert({
                product_id: newProd.id,
                variant_id: createdVar.id,
                movement_type: 'RESTOCK',
                quantity_delta: vStock,
                quantity_before: 0,
                quantity_after: vStock,
                unit_cost: vCost || null,
                reference_type: 'PRODUCT_CREATION',
                note: `Initial stock for pack size ${vLabel}`,
                created_by_name: 'Admin',
              })
            }
          }

          play('success')
          resetForm()
          setStatusMessage({
            type: 'success',
            text: `Multi-pack product "${trimmedName}" created with ${totalVariantStock} total units! Immediately ready in catalog & billing.`,
          })
        }
      }

      await fetchProducts()
      onStockUpdated?.()
    } catch (err: unknown) {
      let msg = getErrorMessage(err, 'An error occurred while saving')
      if (msg.includes('barcode_registry_barcode_value_key') || (msg.includes('barcode') && msg.includes('duplicate key value violates unique constraint'))) {
        msg = 'This barcode is already registered to another item.'
      }
      play('error')
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  const selectedUnitInfo = getSelectedUnitInfo()

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="h-[calc(100dvh-210px)] min-h-[480px] flex flex-col gap-3 lg:gap-5 overflow-hidden">
      {/* Mobile-only: switch between browsing the catalog and the add/edit form */}
      <div className="lg:hidden flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobileView('catalog')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-colors cursor-pointer ${
            mobileView === 'catalog' ? 'bg-[#0A0A0A] text-white' : 'text-gray-600'
          }`}
        >
          <Layers size={14} /> Catalog ({products.length})
        </button>
        <button
          type="button"
          onClick={() => { resetForm(); setMobileView('form') }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-colors cursor-pointer ${
            mobileView === 'form' ? 'bg-[var(--accent)] text-white' : 'text-gray-600'
          }`}
        >
          <Plus size={14} /> Add New Product
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0 overflow-hidden">
      {/* LEFT COLUMN: Products Browser List */}
      <div className={`${mobileView === 'form' ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 xl:w-96 flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm shrink-0 h-full min-h-0`}>
        <div className="px-4 py-3.5 border-b border-gray-200 bg-[#FAFAFA] shrink-0">
          <h4 className="flex items-center gap-2 text-sm font-black text-gray-900">
            <Package size={16} className="text-[var(--accent)]" />
            Product Catalog ({products.length})
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Select any item to view or edit product details</p>
        </div>

        <div className="p-3 border-b border-gray-100 bg-white shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products, SKUs, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-900 outline-none focus:border-[#0A0A0A]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 hide-scrollbar">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 font-bold">
              No products found.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredProducts.map((p) => {
                const stockQty = Number(p.stockQuantity ?? p.stock ?? 0)
                const lowAt = Number(p.lowStockAlert ?? 5)
                const stockColor = stockQty <= 0 ? 'text-red-600' : stockQty <= lowAt ? 'text-amber-600' : 'text-emerald-700'
                const isSelected = selectedProductId === Number(p.id)
                return (
                  <li
                    key={p.id}
                    onClick={() => startEditProduct(p)}
                    className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors border-l-4 ${
                      isSelected ? 'bg-[#FFF9E6] border-[var(--accent)]' : 'border-transparent hover:bg-[#FBFAF6]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-black uppercase text-gray-900 break-words leading-snug">{p.name}</div>
                      <div className="mt-0.5 text-[11px] font-semibold uppercase text-gray-500 truncate">
                        {p.category || 'General'}{p.hasVariants ? ' • Multiple pack sizes' : ''}
                      </div>
                      {p.description?.trim() && (
                        <div className="mt-1 text-[11px] font-medium text-gray-600 break-words line-clamp-2" title={p.description.trim()}>
                          {p.description.trim()}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black text-gray-900 whitespace-nowrap">₹{p.price}</div>
                      <div className={`text-[11px] font-black whitespace-nowrap ${stockColor}`}>Stock: {stockQty}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void startEditProduct(p)
                        }}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 flex items-center justify-center hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all cursor-pointer"
                        title={`Edit "${p.name}"`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteProduct(Number(p.id), p.name)
                        }}
                        className="w-8 h-8 rounded-lg text-gray-400 flex items-center justify-center hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        title={`Delete "${p.name}"`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Product Authoring Form Workspace */}
      <div className={`${mobileView === 'catalog' ? 'hidden lg:flex' : 'flex'} flex-1 flex-col bg-[#FBFAF6] border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-full min-h-0`}>
        {/* Pinned Form Header */}
        <div className="px-3.5 py-3 sm:px-6 sm:py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileView('catalog')}
              className="lg:hidden -ml-1 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 shrink-0 cursor-pointer"
              aria-label="Back to catalog"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-black flex items-center gap-2 truncate">
                <Package size={16} className="text-[var(--accent)] shrink-0" />
                {selectedProductId ? 'Edit Product & Stock Details' : 'Add New Product to Catalog'}
              </h3>
              <p className="text-[11px] text-gray-500 font-semibold">
                {selectedProductId ? "Update pricing, stock & categories" : "Start with the name below"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileView('catalog')}
              className="lg:hidden text-[10px] font-black text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full cursor-pointer"
            >
              Catalog ({products.length})
            </button>
            {selectedProductId && (
              <>
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(selectedProductId, name)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Delete this product"
                >
                  <Trash2 size={13} /> Delete Product
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  + Create Another
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Form Body with Pinned Bottom Action Bar */}
        <form onSubmit={handleSaveProduct} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 hide-scrollbar">
            {/* Status Message */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <span>{statusMessage.text}</span>
                <button onClick={() => setStatusMessage(null)} className="font-black">✕</button>
              </div>
            )}

            {/* Step 1: Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                  1. Product Name (English) <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus={!selectedProductId}
                  placeholder="e.g. Tata Salt, Parle-G Biscuit, Amul Milk"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    Product Name (Tamil)
                    <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                      தமிழ்
                    </span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. டாடா உப்பு, பார்லே-ஜி"
                  value={nameTa}
                  onChange={(e) => setNameTa(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            <>
              {/* Step 2: Unit of Measure */}
                <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2.5">
                  <label className="block text-[11px] font-black uppercase tracking-wide text-gray-700 flex items-center gap-1.5">
                    <Ruler size={13} className="text-[var(--accent)]" /> 2. What unit is it sold in?
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <UnitSelect
                      value={unitChoice}
                      onChange={(next) => {
                        const nextUnit = UNIT_OPTIONS.find((o) => o.value === next)
                        setUnitChoice(next)
                        if (nextUnit && nextUnit.unitType !== 'weight' && nextUnit.unitType !== 'volume') {
                          setSoldByWeight(false)
                        }
                      }}
                    />
                    {unitChoice === 'custom' && (
                      <input
                        type="text"
                        required
                        placeholder="Type your unit, e.g. Sack, Roll, Set"
                        value={customUnitLabel}
                        onChange={(e) => setCustomUnitLabel(e.target.value)}
                        className="w-full sm:max-w-xs h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    )}
                  </div>

                  {/* For packaging units on single-size products, ask what's inside */}
                  {!hasVariants && ['packet', 'box', 'bag', 'bundle', 'bottle', 'tin', 'pouch'].includes(unitChoice) && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-[10px] font-bold text-blue-700 mb-2.5">What's inside each {UNIT_OPTIONS.find(o => o.value === unitChoice)?.suffix}?</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Size (e.g. 200)"
                          value={contentSize}
                          onChange={(e) => setContentSize(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-lg border border-blue-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-blue-600"
                        />
                        <select
                          value={contentUnit}
                          onChange={(e) => setContentUnit(e.target.value)}
                          className="h-9 px-3 rounded-lg border border-blue-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-blue-600 touch-manipulation appearance-none relative z-20"
                        >
                          <option value="">Unit</option>
                          <option value="ml">ml</option>
                          <option value="l">Litre</option>
                          <option value="g">gm</option>
                          <option value="kg">kg</option>
                          <option value="pcs">pcs</option>
                          <option value="piece">piece</option>
                        </select>
                      </div>
                      {contentSize && contentUnit && (
                        <p className="text-[10px] text-blue-600 font-medium mt-2">
                          ✓ Each {UNIT_OPTIONS.find(o => o.value === unitChoice)?.suffix} contains {contentSize}{contentUnit}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 3: Single price vs multiple pack sizes */}
                <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2.5">
                  <label className="block text-[11px] font-black uppercase tracking-wide text-gray-700 flex items-center gap-1.5">
                    <Tag size={13} className="text-[var(--accent)]" /> 3. How is it priced?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setHasVariants(false)}
                      className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        !hasVariants ? 'border-[#0A0A0A] bg-[#FFF9E6]' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="block text-xs font-black text-gray-900">Single Price</span>
                      <span className="block text-[11px] text-gray-500 font-medium mt-0.5">
                        One fixed price, e.g. a bar of soap at ₹45
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHasVariants(true)
                        setSoldByWeight(false)
                        if (variantRows.length === 0) handleAddVariantRow()
                      }}
                      className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        hasVariants ? 'border-[#0A0A0A] bg-[#FFF9E6]' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="block text-xs font-black text-gray-900">Multiple Pack Sizes</span>
                      <span className="block text-[11px] text-gray-500 font-medium mt-0.5">
                        Different prices per quantity, e.g. 200gm ₹45, 500gm ₹100, 1kg ₹190
                      </span>
                    </button>
                  </div>
                </div>

                {/* Sold loose by weight/volume — only makes sense for a single-price kg/gm/L/ml product */}
                {!hasVariants && (selectedUnitInfo.unitType === 'weight' || selectedUnitInfo.unitType === 'volume') && (
                  <div className="p-3.5 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="block text-xs font-black text-gray-900">Sold Loose By Weight</span>
                        <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                          Turn on for items weighed at the counter (e.g. loose rice, oil). Price becomes per {selectedUnitInfo.suffix}, and billing lets you enter any amount like 2.3{selectedUnitInfo.suffix}.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={soldByWeight}
                          onChange={(e) => setSoldByWeight(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]" />
                      </label>
                    </div>
                  </div>
                )}

                {/* Single Price & Received Stock */}
                {!hasVariants && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-white border border-gray-200 rounded-xl items-start">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                        {soldByWeight ? `Price per ${selectedUnitInfo.suffix} (₹)` : 'Selling Price (₹)'} <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required={!hasVariants}
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                        {soldByWeight ? `Cost per ${selectedUnitInfo.suffix} (₹)` : 'Purchase / Cost Price (₹)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-emerald-800 mb-1.5 h-4 flex items-center gap-1">
                        <Boxes size={13} className="text-emerald-600 shrink-0" />
                        <span>Received / Current Stock {soldByWeight ? `(${selectedUnitInfo.suffix})` : ''}</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step={soldByWeight ? '0.001' : '1'}
                        placeholder="0"
                        value={stockQuantity}
                        onChange={(e) => setStockQuantity(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50 text-xs font-bold text-emerald-950 outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Pack Size Repeater */}
                {hasVariants && (
                  <div className="border border-gray-200 rounded-xl p-3.5 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-700">
                        Pack Sizes ({variantRows.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleAddVariantRow}
                        className="px-3 py-1 rounded-lg bg-[#0A0A0A] text-[var(--accent)] text-xs font-black flex items-center gap-1 hover:bg-[#1A1A1A] cursor-pointer"
                      >
                        <Plus size={12} /> Add Pack Size
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {variantRows.map((v) => (
                        <div
                          key={v.id}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 rounded-xl bg-[#FBFAF6] border border-gray-200 items-center"
                        >
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                              Pack Size & Unit
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                placeholder="e.g. 200"
                                value={v.qty}
                                onChange={(e) => handleUpdateVariantRow(v.id, 'qty', e.target.value)}
                                className="w-full min-w-0 flex-1 h-8 px-2 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                              />
                              <select
                                value={v.unit || selectedUnitInfo.suffix}
                                onChange={(e) => handleUpdateVariantRow(v.id, 'unit', e.target.value)}
                                className="w-20 shrink-0 h-8 px-1 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:border-[#0A0A0A]"
                              >
                                <option value="gm">gm</option>
                                <option value="kg">kg</option>
                                <option value="ml">ml</option>
                                <option value="L">L</option>
                                <option value="pcs">pcs</option>
                                <option value="packet">packet</option>
                                <option value="box">box</option>
                                <option value="pouch">pouch</option>
                                <option value="tin">tin</option>
                                <option value="bundle">bundle</option>
                                {selectedUnitInfo.suffix && !['gm', 'kg', 'ml', 'L', 'pcs', 'packet', 'box', 'pouch', 'tin', 'bundle'].includes(selectedUnitInfo.suffix) && (
                                  <option value={selectedUnitInfo.suffix}>{selectedUnitInfo.suffix}</option>
                                )}
                              </select>
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                              Selling Price (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              placeholder="0.00"
                              value={v.price || ''}
                              onChange={(e) => handleUpdateVariantRow(v.id, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                              Cost Price (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={v.costPrice || ''}
                              onChange={(e) => handleUpdateVariantRow(v.id, 'costPrice', parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">
                              Received Stock
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={v.stock || ''}
                              onChange={(e) => handleUpdateVariantRow(v.id, 'stock', parseInt(e.target.value) || 0)}
                              className="w-full h-8 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50/40 text-xs font-black text-emerald-950 outline-none focus:border-emerald-600"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                              Barcode / SKU
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 8901234567"
                              value={v.customBarcode || ''}
                              onChange={(e) => handleUpdateVariantRow(v.id, 'customBarcode', e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                              title="Product barcode for this pack size (optional)"
                            />
                          </div>

                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveVariantRow(v.id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Remove pack size"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="sm:col-span-6">
                            <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Mfg Date</label>
                            <DateInputDDMMYYYY
                              value={v.mfgDate || ''}
                              onChange={(val) => handleUpdateVariantRow(v.id, 'mfgDate', val)}
                              placeholder="DD/MM/YYYY"
                              className={DATE_INPUT_CLASS}
                            />
                          </div>
                          <div className="sm:col-span-6">
                            <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Expiry Date</label>
                            <DateInputDDMMYYYY
                              value={v.expiryDate || ''}
                              onChange={(val) => handleUpdateVariantRow(v.id, 'expiryDate', val)}
                              placeholder="DD/MM/YYYY"
                              className={DATE_INPUT_CLASS}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Details (secondary, always reachable, no extra clicks) */}
                <div className="pt-1 space-y-4">
                  <div className="flex items-center gap-2 px-0.5">
                    <SlidersHorizontal size={13} className="text-[var(--accent)]" />
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-600">Additional Details (Optional)</span>
                  </div>

                  <div className="space-y-4">
                    {/* Category, Barcode, Storage Location, Low Stock Alert, Manufacture Date, and Expiry Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 items-start">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                          Category
                        </label>
                        <select
                          value={categoryId}
                          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full h-10 px-3.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] touch-manipulation appearance-none relative z-20"
                        >
                          <option value="">-- Select Category --</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name_en}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                          Barcode / SKU <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          disabled={hasVariants}
                          placeholder={hasVariants ? 'Define per pack size →' : 'e.g. 8901234567'}
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          autoCapitalize="off"
                          autoCorrect="off"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full h-10 px-3.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] disabled:bg-gray-100 disabled:text-gray-400"
                          title="Enter the product barcode (EAN/UPC code printed on the package). Used for quick scanning in billing."
                        />
                        <p className="text-[10px] text-gray-500 font-medium mt-1">
                          {hasVariants
                            ? '👉 Enter barcode for each pack size below'
                            : '💡 Scan in billing to quickly add this product. Leave empty if product has no barcode.'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                          Storage Location <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Rack 3, Row 2"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      {hasVariants && (
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                          Description / Notes <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                        </label>
                        <textarea
                        rows={1}
                        placeholder="Brand, pack details, usage or storage notes..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full h-10 px-3.5 py-2.5 leading-5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-xs font-medium text-gray-900 outline-none focus:border-[#0A0A0A] resize-none"
                      />
                      </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                          Low Stock Alert Threshold
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="5"
                          value={lowStockAlert}
                          onChange={(e) => setLowStockAlert(e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      {!hasVariants && (<>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                          Mfg Date
                        </label>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <DateInputDDMMYYYY
                              value={mfgDate}
                              onChange={setMfgDate}
                              placeholder="DD/MM/YYYY"
                              className={DATE_INPUT_CLASS}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={generateRandomDates}
                            title="Generate random manufacture and expiry dates"
                            aria-label="Generate random manufacture and expiry dates"
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 transition-colors"
                          >
                            <Dices size={16} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                          Expiry Date
                        </label>
                        <DateInputDDMMYYYY
                          value={expiryDate}
                          onChange={setExpiryDate}
                          placeholder="DD/MM/YYYY"
                          className={DATE_INPUT_CLASS}
                        />
                      </div>
                      </>)}
                    </div>

                    {/* Description (with pack sizes it sits beside Low Stock Alert above) */}
                    {!hasVariants && (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                        Description / Notes <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Brand, pack details, usage or storage notes..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-xs font-medium text-gray-900 outline-none focus:border-[#0A0A0A] resize-none"
                      />
                    </div>
                    )}

                    {/* Special Offer / Free Gift */}
                    <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-black flex items-center gap-1.5">
                            🎁 Special Offer / Free Gift
                          </span>
                          <p className="text-[11px] text-gray-500 font-medium">
                            Flag this product so staff see it in billing and can note what's included.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasSpecialOffer}
                            onChange={(e) => setHasSpecialOffer(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]" />
                        </label>
                      </div>
                      {hasSpecialOffer && (
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wide text-gray-500 mb-1">Offer / Gift Note</label>
                            <input
                              type="text"
                              placeholder="e.g. Buy 1 Get 1 Free, or Free sample gift with purchase"
                              value={specialOfferNote}
                              onChange={(e) => setSpecialOfferNote(e.target.value)}
                              className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs font-medium text-gray-900 outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wide text-gray-500 mb-1">Gift Cost (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              value={specialOfferCost}
                              onChange={(e) => setSpecialOfferCost(e.target.value)}
                              className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs font-medium text-gray-900 outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            </>
          </div>

          {/* Pinned Bottom Actions */}
          <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-gray-200 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-[#0A0A0A] border border-[var(--accent)] text-[var(--accent)] text-xs font-black uppercase tracking-wider hover:bg-[#1A1A1A] transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[var(--accent-a30)] border-t-[var(--accent)] rounded-full animate-spin inline-block" />
                  Saving Product...
                </>
              ) : (
                <>
                  <Check size={14} /> {selectedProductId ? 'Update Product' : 'Save & Add Product'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  )
}
