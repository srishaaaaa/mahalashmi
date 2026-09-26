import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProductStore, type Product } from '../../store/store'
import { fetchVariantsByProduct } from '../../services/variantService'
import { inventoryService, type CategoryRecord } from '../../services/inventoryService'
import { useSound } from '../../context/SoundContext'
import { getErrorMessage } from '../../lib/errorMessage'
import { normalizeBarcode } from '../../lib/barcode'
import { roundTo } from '../../lib/retail'
import { UNIT_OPTIONS, UNIT_GROUPS, findUnitOption } from '../../lib/units'
import { DateInputDDMMYYYY } from '../DateInputDDMMYYYY'

export interface VariantInputRow {
  id: string
  qty: string
  price: number
  costPrice: number
  stock: number
  customBarcode?: string
}

// Extracts the leading number from a stored size label (e.g. "20gm" -> "20") so
// existing variant rows still show a sensible quantity when the product is reopened.
const parseQtyFromLabel = (label?: string | null): string => {
  if (!label) return ''
  const match = label.match(/^(\d+(?:\.\d+)?)/)
  return match ? match[1] : ''
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
  const [mobileView, setMobileView] = useState<'catalog' | 'form'>('catalog')

  // Form State
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [price, setPrice] = useState<string>('')
  const [purchasePrice, setPurchasePrice] = useState<string>('')
  const [unitChoice, setUnitChoice] = useState<string>('pcs')
  const [customUnitLabel, setCustomUnitLabel] = useState<string>('')
  const [contentSize, setContentSize] = useState<string>('') // e.g. "200ml", "500g" for packets
  const [contentUnit, setContentUnit] = useState<string>('') // e.g. "ml", "g"
  const [stockQuantity, setStockQuantity] = useState<string>('0')
  const [lowStockAlert, setLowStockAlert] = useState<string>('5')
  const [expiryDate, setExpiryDate] = useState<string>('')
  const [mfgDate, setMfgDate] = useState<string>('')
  const [location, setLocation] = useState<string>('')
  const [barcode, setBarcode] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [hasVariants, setHasVariants] = useState<boolean>(false)
  const [soldByWeight, setSoldByWeight] = useState<boolean>(false)
  const [hasSpecialOffer, setHasSpecialOffer] = useState<boolean>(false)
  const [specialOfferNote, setSpecialOfferNote] = useState<string>('')
  const [specialOfferCost, setSpecialOfferCost] = useState<string>('')

  // Variants Rows for dynamic addition
  const [variantRows, setVariantRows] = useState<VariantInputRow[]>([])

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
    const mfgFormatted = `${String(mfgDate.getDate()).padStart(2, '0')}/${String(mfgDate.getMonth() + 1).padStart(2, '0')}/${mfgDate.getFullYear()}`

    const expiryDaysFromToday = Math.floor(Math.random() * 335) + 30
    const expiryDate = new Date(today)
    expiryDate.setDate(expiryDate.getDate() + expiryDaysFromToday)
    const expiryFormatted = `${String(expiryDate.getDate()).padStart(2, '0')}/${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${expiryDate.getFullYear()}`

    setMfgDate(mfgFormatted)
    setExpiryDate(expiryFormatted)
  }

  useEffect(() => {
    void fetchProducts()
    inventoryService.fetchCategories().then(setCategories).catch(console.error)
  }, [fetchProducts])

  const resetForm = () => {
    setSelectedProductId(null)
    setName('')
    setCategoryId('')
    setPrice('')
    setPurchasePrice('')
    setUnitChoice('pcs')
    setCustomUnitLabel('')
    setContentSize('')
    setContentUnit('')
    setStockQuantity('0')
    setLowStockAlert('5')
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
  }

  const startEditProduct = async (p: Product) => {
    setMobileView('form')
    setSelectedProductId(Number(p.id))
    setName(p.name || '')
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
    setLowStockAlert(p.lowStockAlert ? String(p.lowStockAlert) : '5')
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

    if (p.hasVariants) {
      try {
        const vars = await fetchVariantsByProduct(String(p.id))
        setVariantRows(
          vars.map((v) => ({
            id: v.id,
            qty: parseQtyFromLabel(v.sizeLabel || v.variantName),
            price: v.price,
            costPrice: v.purchasePrice || 0,
            stock: v.stock || 0,
            customBarcode: v.barcode || '',
          }))
        )
      } catch (err) {
        console.error('Failed to load variants for edit:', err)
      }
    } else {
      setVariantRows([])
    }
  }

  const handleAddVariantRow = () => {
    const baseP = parseFloat(price) || 0
    const baseC = parseFloat(purchasePrice) || 0
    setVariantRows((prev) => [
      ...prev,
      {
        id: `var_${Date.now()}_${Math.random()}`,
        qty: '',
        price: baseP,
        costPrice: baseC,
        stock: 0,
        customBarcode: '',
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
    const labelForQty = (qty: string) => `${qty.trim()}${selectedUnit.suffix}`

    const firstVariant = variantRows.find((v) => v.qty.trim())
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
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              unit_type: selectedUnit.unitType,
              unit_label: selectedUnit.unit,
              unit: selectedUnit.unit,
              low_stock_alert: alertThreshold,
              expiry_date: expiryDate || null,
              mfg_date: mfgDate || null,
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
            const vLabel = labelForQty(v.qty)
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
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              unit_type: selectedUnit.unitType,
              unit_label: selectedUnit.unit,
              unit: selectedUnit.unit,
              low_stock_alert: alertThreshold,
              expiry_date: expiryDate || null,
              mfg_date: mfgDate || null,
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
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              unit_type: selectedUnit.unitType,
              unit_label: selectedUnit.unit,
              unit: selectedUnit.unit,
              low_stock_alert: alertThreshold,
              expiry_date: expiryDate || null,
              mfg_date: mfgDate || null,
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
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              unit_type: selectedUnit.unitType,
              unit_label: selectedUnit.unit,
              unit: selectedUnit.unit,
              low_stock_alert: alertThreshold,
              expiry_date: expiryDate || null,
              mfg_date: mfgDate || null,
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
            const vLabel = labelForQty(v.qty)
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
        <div className="p-3.5 border-b border-gray-200 bg-[#FAFAFA] shrink-0">
          <h4 className="text-xs font-bold text-gray-800">
            Product Catalog ({products.length})
          </h4>
          <p className="text-[10px] text-gray-500 mt-0.5">Select any item to view or edit product details</p>
        </div>

        <div className="p-3 border-b border-gray-100 bg-[#FBFAF6] shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products, SKUs, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 hide-scrollbar">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 font-bold">
              No products found.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#FAFAFA] text-[9px] font-black uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3.5 py-2">Product</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Stock</th>
                  <th className="w-14 px-1 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => startEditProduct(p)}
                    className={`group cursor-pointer hover:bg-[#FBFAF6] transition-colors ${
                      selectedProductId === Number(p.id) ? 'bg-[#FFF9E6] border-l-4 border-[var(--accent)]' : ''
                    }`}
                  >
                    <td className="max-w-[140px] whitespace-normal break-words px-3.5 py-2.5 align-top">
                      <div className="font-bold text-xs text-gray-900 break-words">{p.name}</div>
                      <div className="text-[10px] text-gray-400 font-medium">
                        {p.category || 'General'} {p.hasVariants ? '• Multiple pack sizes' : ''}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right align-top font-black text-xs text-gray-900 whitespace-nowrap">₹{p.price}</td>
                    <td className="px-2 py-2.5 text-right align-top text-[10px] text-emerald-700 font-bold whitespace-nowrap">
                      {p.stockQuantity ?? p.stock ?? 0}
                    </td>
                    <td className="px-1 py-2.5 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void startEditProduct(p)
                          }}
                          className="p-1 rounded-md border border-gray-200 text-gray-500 hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[#EAF6EC] transition-all cursor-pointer"
                          title={`Edit "${p.name}"`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProduct(Number(p.id), p.name)
                          }}
                          className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                          title={`Delete "${p.name}"`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  1. What's the product? <span className="text-red-500 ml-0.5">*</span>
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

            </div>

            {!name.trim() ? (
              <div className="flex items-center gap-2 text-[11px] text-gray-400 font-semibold px-1 py-2">
                <Ruler size={13} /> Type a product name above — unit &amp; pricing questions will appear next.
              </div>
            ) : (
              <>
                {/* Step 2: Unit of Measure */}
                <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2.5">
                  <label className="block text-[11px] font-black uppercase tracking-wide text-gray-700 flex items-center gap-1.5">
                    <Ruler size={13} className="text-[var(--accent)]" /> 2. What unit is it sold in?
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <select
                      value={unitChoice}
                      onChange={(e) => {
                        const nextUnit = UNIT_OPTIONS.find((o) => o.value === e.target.value)
                        setUnitChoice(e.target.value)
                        if (nextUnit && nextUnit.unitType !== 'weight' && nextUnit.unitType !== 'volume') {
                          setSoldByWeight(false)
                        }
                      }}
                      className="w-full sm:max-w-xs h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] touch-manipulation appearance-none relative z-20"
                    >
                      {UNIT_GROUPS.map((group) => (
                        <optgroup key={group} label={group}>
                          {UNIT_OPTIONS.filter((o) => o.group === group).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
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

                  {/* For packaging units (packet, box, bag, etc.), ask what's inside */}
                  {['packet', 'box', 'bag', 'bundle', 'bottle', 'tin', 'pouch'].includes(unitChoice) && (
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
                        Different prices per quantity, e.g. 20{selectedUnitInfo.suffix} ₹12, 50{selectedUnitInfo.suffix} ₹45, 100{selectedUnitInfo.suffix} ₹85
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
                              Quantity ({selectedUnitInfo.suffix})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              placeholder="e.g. 20"
                              value={v.qty}
                              onChange={(e) => handleUpdateVariantRow(v.id, 'qty', e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                              Price (₹)
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
                              Cost (₹)
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Details (secondary, always reachable, no extra clicks) */}
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-2.5 px-0.5">
                    <SlidersHorizontal size={13} className="text-gray-400" />
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">Additional Details (Optional)</span>
                  </div>

                  <div className="space-y-4">
                    {/* Category, Barcode, Storage Location, Low Stock Alert, Manufacture Date, and Expiry Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                          Category
                        </label>
                        <select
                          value={categoryId}
                          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] touch-manipulation appearance-none relative z-20"
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
                          className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] disabled:bg-gray-100 disabled:text-gray-400"
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
                          className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

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
                          className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <DateInputDDMMYYYY
                            label="Mfg Date"
                            value={mfgDate}
                            onChange={setMfgDate}
                            placeholder="DD/MM/YYYY"
                            className="h-10 px-3.5 text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={generateRandomDates}
                          title="Generate random manufacture and expiry dates"
                          className="h-10 px-3 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-700 text-xs font-bold transition-colors shrink-0"
                        >
                          🎲
                        </button>
                      </div>

                      <DateInputDDMMYYYY
                        label="Expiry Date"
                        value={expiryDate}
                        onChange={setExpiryDate}
                        placeholder="DD/MM/YYYY"
                        className="h-10 px-3.5 text-xs"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                        Description / Notes <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Product material, care instructions, or rack location notes..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs font-medium text-gray-900 outline-none focus:border-[#0A0A0A] resize-none"
                      />
                    </div>

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
            )}
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
