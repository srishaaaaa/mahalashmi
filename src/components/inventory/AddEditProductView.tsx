import React, { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Check,
  Package,
  Tag,
  Boxes,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProductStore, type Product } from '../../store/store'
import { fetchVariantsByProduct } from '../../services/variantService'
import { inventoryService, type CategoryRecord } from '../../services/inventoryService'

export interface VariantInputRow {
  id: string
  variantName: string
  sizeLabel?: string
  price: number
  costPrice: number
  stock: number
  customBarcode?: string
}

export const AddEditProductView: React.FC<{ onStockUpdated?: () => void }> = ({ onStockUpdated }) => {
  const { products, fetchProducts } = useProductStore()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [nameTa, setNameTa] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [price, setPrice] = useState<string>('')
  const [purchasePrice, setPurchasePrice] = useState<string>('')
  const [stockQuantity, setStockQuantity] = useState<string>('0')
  const [lowStockAlert, setLowStockAlert] = useState<string>('5')
  const [barcode, setBarcode] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [hasVariants, setHasVariants] = useState<boolean>(false)
  const [hasSpecialOffer, setHasSpecialOffer] = useState<boolean>(false)
  const [specialOfferNote, setSpecialOfferNote] = useState<string>('')
  const [specialOfferCost, setSpecialOfferCost] = useState<string>('')

  // Variants Rows for dynamic addition
  const [variantRows, setVariantRows] = useState<VariantInputRow[]>([])

  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    void fetchProducts()
    inventoryService.fetchCategories().then(setCategories).catch(console.error)
  }, [fetchProducts])

  const resetForm = () => {
    setSelectedProductId(null)
    setName('')
    setNameTa('')
    setCategoryId('')
    setPrice('')
    setPurchasePrice('')
    setStockQuantity('0')
    setLowStockAlert('5')
    setBarcode('')
    setDescription('')
    setHasVariants(false)
    setHasSpecialOffer(false)
    setSpecialOfferNote('')
    setSpecialOfferCost('')
    setVariantRows([])
    setStatusMessage(null)
  }

  const startEditProduct = async (p: Product) => {
    setSelectedProductId(Number(p.id))
    setName(p.name || '')
    setNameTa(p.nameTa || p.tamilName || '')
    setCategoryId(p.categoryId ? Number(p.categoryId) : '')
    setPrice(String(p.price || ''))
    setPurchasePrice(String(p.purchasePrice || ''))
    setStockQuantity(String(p.stockQuantity ?? p.stock ?? 0))
    setLowStockAlert(p.lowStockAlert ? String(p.lowStockAlert) : '5')
    setBarcode(p.barcode || '')
    setDescription(p.description || '')
    setHasVariants(Boolean(p.hasVariants))
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
            variantName: v.variantName,
            sizeLabel: v.sizeLabel || v.variantName,
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
        variantName: '',
        sizeLabel: '',
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
      onStockUpdated?.()
      setStatusMessage({ type: 'success', text: `Product "${prodName}" deleted successfully.` })
    } catch (err) {
      console.error('Failed to delete product:', err)
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete product' })
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

    const firstVariant = variantRows.find((v) => v.variantName.trim())
    const priceNum = hasVariants && firstVariant ? (Number(firstVariant.price) || 0) : (parseFloat(price) || 0)
    const costNum = hasVariants && firstVariant ? (Number(firstVariant.costPrice) || 0) : (parseFloat(purchasePrice) || 0)

    if (!hasVariants && priceNum <= 0) {
      setStatusMessage({ type: 'error', text: 'Price must be greater than 0' })
      return
    }

    if (hasVariants && (!variantRows.length || variantRows.some((v) => !v.variantName.trim()))) {
      setStatusMessage({ type: 'error', text: 'Please provide names for all added variants' })
      return
    }

    const selectedCat = categories.find((c) => Number(c.id) === Number(categoryId))
    const categoryName = selectedCat ? selectedCat.name_en : 'General'
    const alertThreshold = Number(lowStockAlert) > 0 ? Number(lowStockAlert) : 5

    setLoading(true)

    try {
      if (selectedProductId) {
        // UPDATE EXISTING PRODUCT
        if (!hasVariants) {
          const inputStock = Math.max(0, parseInt(stockQuantity) || 0)

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
              name_ta: nameTa.trim() || '',
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              low_stock_alert: alertThreshold,
              barcode: barcode.trim() || null,
              description: description.trim() || '',
              has_variants: false,
              has_special_offer: hasSpecialOffer,
              special_offer_note: specialOfferNote.trim(),
              special_offer_cost: hasSpecialOffer ? (Number(specialOfferCost) || 0) : 0,
              stock_quantity: inputStock,
              stock: inputStock,
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

          if (barcode.trim()) {
            await supabase.from('barcode_registry').upsert(
              {
                barcode: barcode.trim(),
                product_id: selectedProductId,
                variant_id: null,
                is_active: true,
              },
              { onConflict: 'barcode' }
            )
          }

          setStatusMessage({
            type: 'success',
            text: `Product "${trimmedName}" updated successfully with ${inputStock} stock units! Ready in POS Catalog.`,
          })
        } else {
          // Multi-variant update
          let totalVariantStock = 0
          for (const v of variantRows) {
            if (!v.variantName.trim()) continue
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
                  variant_name: v.variantName.trim(),
                  size_label: v.sizeLabel?.trim() || v.variantName.trim(),
                  price: vPrice,
                  purchase_price: vCost,
                  stock: vStock,
                  barcode: v.customBarcode?.trim() || null,
                  is_active: true,
                })
                .select()
                .single()

              if (!vErr && createdVar && vStock > 0) {
                await supabase.from('inventory_movements').insert({
                  product_id: selectedProductId,
                  variant_id: createdVar.id,
                  movement_type: 'RESTOCK',
                  quantity_delta: vStock,
                  quantity_before: 0,
                  quantity_after: vStock,
                  unit_cost: vCost || null,
                  reference_type: 'PRODUCT_UPDATE',
                  note: `Added variant ${v.variantName.trim()} with stock`,
                  created_by_name: 'Admin',
                })
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
                  variant_name: v.variantName.trim(),
                  size_label: v.sizeLabel?.trim() || v.variantName.trim(),
                  price: vPrice,
                  purchase_price: vCost,
                  stock: vStock,
                  barcode: v.customBarcode?.trim() || null,
                })
                .eq('id', v.id)

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
                  note: `Stock updated for variant ${v.variantName.trim()}`,
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
              name_ta: nameTa.trim() || '',
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              low_stock_alert: alertThreshold,
              barcode: null,
              description: description.trim() || '',
              has_variants: true,
              has_special_offer: hasSpecialOffer,
              special_offer_note: specialOfferNote.trim(),
              special_offer_cost: hasSpecialOffer ? (Number(specialOfferCost) || 0) : 0,
              stock_quantity: totalVariantStock,
              stock: totalVariantStock,
            })
            .eq('id', selectedProductId)

          setStatusMessage({
            type: 'success',
            text: `Product "${trimmedName}" updated with ${totalVariantStock} total variant stock units! Ready in POS Catalog.`,
          })
        }
      } else {
        // CREATE NEW PRODUCT
        if (!hasVariants) {
          const inputStock = Math.max(0, parseInt(stockQuantity) || 0)

          const { data: newProd, error: insErr } = await supabase
            .from('products')
            .insert({
              name: trimmedName,
              name_ta: nameTa.trim() || '',
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              low_stock_alert: alertThreshold,
              barcode: barcode.trim() || null,
              description: description.trim() || '',
              has_variants: false,
              has_special_offer: hasSpecialOffer,
              special_offer_note: specialOfferNote.trim(),
              special_offer_cost: hasSpecialOffer ? (Number(specialOfferCost) || 0) : 0,
              stock_quantity: inputStock,
              stock: inputStock,
              is_active: true,
            })
            .select('id, name')
            .single()

          if (insErr || !newProd) throw insErr || new Error('Failed to create product')

          if (barcode.trim()) {
            await supabase.from('barcode_registry').upsert(
              {
                barcode: barcode.trim(),
                product_id: newProd.id,
                variant_id: null,
                is_active: true,
              },
              { onConflict: 'barcode' }
            )
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

          setStatusMessage({
            type: 'success',
            text: `Product "${trimmedName}" created with ${inputStock} stock units! Immediately ready in catalog & billing.`,
          })
          resetForm()
        } else {
          // Multi-variant creation
          let totalVariantStock = 0
          variantRows.forEach((v) => {
            if (v.variantName.trim()) {
              totalVariantStock += Math.max(0, Number(v.stock) || 0)
            }
          })

          const { data: newProd, error: insErr } = await supabase
            .from('products')
            .insert({
              name: trimmedName,
              name_ta: nameTa.trim() || '',
              category: categoryName,
              category_id: categoryId ? Number(categoryId) : null,
              price: priceNum,
              offer_price: priceNum,
              purchase_price: costNum,
              low_stock_alert: alertThreshold,
              barcode: null,
              description: description.trim() || '',
              has_variants: true,
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
            if (!v.variantName.trim()) continue
            const vPrice = Number(v.price) > 0 ? Number(v.price) : priceNum
            const vCost = Number(v.costPrice) > 0 ? Number(v.costPrice) : costNum
            const vStock = Math.max(0, Number(v.stock) || 0)

            const { data: createdVar } = await supabase
              .from('product_variants')
              .insert({
                product_id: newProd.id,
                variant_name: v.variantName.trim(),
                size_label: v.sizeLabel?.trim() || v.variantName.trim(),
                price: vPrice,
                purchase_price: vCost,
                stock: vStock,
                barcode: v.customBarcode?.trim() || null,
                is_active: true,
              })
              .select('id')
              .single()

            if (createdVar && v.customBarcode?.trim()) {
              await supabase.from('barcode_registry').upsert(
                {
                  barcode: v.customBarcode.trim(),
                  product_id: newProd.id,
                  variant_id: createdVar.id,
                  is_active: true,
                },
                { onConflict: 'barcode' }
              )
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
                note: `Initial stock for variant ${v.variantName.trim()}`,
                created_by_name: 'Admin',
              })
            }
          }

          setStatusMessage({
            type: 'success',
            text: `Multi-variant product "${trimmedName}" created with ${totalVariantStock} total units! Immediately ready in catalog & billing.`,
          })
          resetForm()
        }
      }

      await fetchProducts()
      onStockUpdated?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while saving'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="h-[calc(100vh-210px)] min-h-[480px] flex flex-col lg:flex-row gap-5 overflow-hidden">
      {/* LEFT COLUMN: Products Browser List */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm shrink-0 h-full min-h-0">
        <div className="p-3.5 border-b border-gray-200 bg-[#FAFAFA] flex items-center justify-between shrink-0">
          <h4 className="text-xs font-bold text-gray-800">
            Product Catalog ({products.length})
          </h4>
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

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 min-h-0 hide-scrollbar">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 font-bold">
              No products found.
            </div>
          ) : (
            filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => startEditProduct(p)}
                className={`group p-3.5 hover:bg-[#FBFAF6] cursor-pointer flex items-center justify-between transition-colors ${
                  selectedProductId === Number(p.id) ? 'bg-[#FFF9E6] border-l-4 border-[#2E7D32]' : ''
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-xs text-gray-900 break-words">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">
                    {p.category || 'General'} {p.hasVariants ? '• Multi-variant' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="font-black text-xs text-gray-900">₹{p.price}</span>
                    <span className="block text-[10px] text-emerald-700 font-bold">
                      Stock: {p.stockQuantity ?? p.stock ?? 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteProduct(Number(p.id), p.name)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                    title={`Delete "${p.name}"`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Product Authoring Form Workspace */}
      <div className="flex-1 flex flex-col bg-[#FBFAF6] border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-full min-h-0">
        {/* Pinned Form Header */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              <Package size={16} className="text-[#2E7D32]" />
              {selectedProductId ? 'Edit Product & Stock Details' : 'Add New Product to Catalog'}
            </h3>
            <p className="text-[11px] text-gray-500 font-semibold">
              Receive stock, configure pricing &amp; categories (Barcode is optional)
            </p>
          </div>
          {selectedProductId && (
            <div className="flex items-center gap-3">
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
            </div>
          )}
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

            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                  Product Name (English) <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Linen Cotton Shirt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                  Tamil Name <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. காட்டன் சட்டை"
                  value={nameTa}
                  onChange={(e) => setNameTa(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            {/* Category, Barcode, and Low Stock Alert */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
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
                  Barcode <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="text"
                  disabled={hasVariants}
                  placeholder={hasVariants ? 'Defined at variant level' : 'e.g. 8901234567'}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] disabled:bg-gray-100 disabled:text-gray-400"
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
            </div>

            {/* Base Pricing & Received Stock (only if no variants) */}
            {!hasVariants && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-white border border-gray-200 rounded-xl items-start">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1.5 h-4 flex items-center">
                    Selling Price (₹) <span className="text-red-500 ml-0.5">*</span>
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
                    Purchase / Cost Price (₹)
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
                    <span>Received / Current Stock</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50 text-xs font-bold text-emerald-950 outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>
              </div>
            )}

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
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2E7D32]" />
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
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs font-medium text-gray-900 outline-none focus:border-[#2E7D32]"
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
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs font-medium text-gray-900 outline-none focus:border-[#2E7D32]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Variant Switch & Matrix */}
            <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-black flex items-center gap-1.5">
                    <Tag size={14} className="text-[#2E7D32]" /> Multi-Variant Product (Sizes, Colors, SKUs)
                  </span>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Enable if this product comes in multiple sizes (e.g. S, M, L, XL) or colors
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => {
                      setHasVariants(e.target.checked)
                      if (e.target.checked && variantRows.length === 0) {
                        handleAddVariantRow()
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A0A0A]" />
                </label>
              </div>

              {hasVariants && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-700">
                      Variant SKUs ({variantRows.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddVariantRow}
                      className="px-3 py-1 rounded-lg bg-[#0A0A0A] text-[#2E7D32] text-xs font-black flex items-center gap-1 hover:bg-[#1A1A1A] cursor-pointer"
                    >
                      <Plus size={12} /> Add Variant
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
                            Variant (e.g. Size M)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="M, Red-38, etc."
                            value={v.variantName}
                            onChange={(e) => handleUpdateVariantRow(v.id, 'variantName', e.target.value)}
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
                            Barcode (Opt)
                          </label>
                          <input
                            type="text"
                            placeholder="Optional"
                            value={v.customBarcode || ''}
                            onChange={(e) => handleUpdateVariantRow(v.id, 'customBarcode', e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantRow(v.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove variant"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
              className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-[#0A0A0A] border border-[#2E7D32] text-[#2E7D32] text-xs font-black uppercase tracking-wider hover:bg-[#1A1A1A] transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[#2E7D32]/30 border-t-[#2E7D32] rounded-full animate-spin inline-block" />
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
  )
}
