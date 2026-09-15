import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarX2, Download, RefreshCw, Search } from 'lucide-react'
import { useProductStore, useSettingsStore } from '../store/store'
import { formatCurrency } from '../lib/retail'

type StatusFilter = 'expired' | 'soon' | 'all'

const excelSafeText = (value: string) => `="${String(value).replace(/"/g, '""')}"`

export default function ExpiryAlerts() {
  const { products, fetchProducts } = useProductStore()
  const alertDays = useSettingsStore(s => s.settings?.expiryAlertDays ?? 30)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('expired')

  useEffect(() => { void fetchProducts() }, [fetchProducts])

  const tracked = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const msPerDay = 24 * 60 * 60 * 1000
    return products
      .filter(p => p.isActive !== false)
      .filter(p => (p.category || '').trim().toLowerCase() !== 'unregistered')
      .filter(p => Boolean(p.expiryDate))
      .map(p => {
        const expiry = new Date(`${p.expiryDate}T00:00:00`)
        const daysLeft = Math.round((expiry.getTime() - today.getTime()) / msPerDay)
        return { ...p, daysLeft }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [products])

  const expired = tracked.filter(p => p.daysLeft < 0)
  const soon = tracked.filter(p => p.daysLeft >= 0 && p.daysLeft <= alertDays)

  const filtered = (statusFilter === 'expired' ? expired : statusFilter === 'soon' ? soon : tracked)
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase())
    )

  const exportCSV = () => {
    const header = ['Product', 'Category', 'Stock', 'Price (INR)', 'Expiry Date', 'Status']
    const rows = filtered.map(p => [
      p.name,
      p.category || 'General',
      String(p.stockQuantity ?? p.stock ?? 0),
      Number(p.price || 0).toFixed(2),
      excelSafeText(p.expiryDate || ''),
      p.daysLeft < 0 ? `Expired ${Math.abs(p.daysLeft)} day(s) ago` : `Expires in ${p.daysLeft} day(s)`,
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expiry-alerts_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cards = [
    ['Expired Items', expired.length, CalendarX2, 'text-red-700 bg-red-50'],
    ['Expiring Soon', soon.length, CalendarClock, 'text-amber-700 bg-amber-50'],
  ] as const

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-600">Batches that need attention</p>
          <h2 className="text-2xl font-black text-[#273126]">Expiry Alerts</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Flagging items within {alertDays} days of their expiry date.{' '}
            <button
              type="button"
              onClick={() => navigate('/dashboard?tab=settings')}
              className="font-bold text-[#2E7D32] hover:underline cursor-pointer"
            >
              Customize window
            </button>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-xl border border-[#ECE9E2] bg-white px-4 py-2.5 text-sm font-bold text-[#273126] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download size={16} /> Export CSV
          </button>
          <button onClick={() => void fetchProducts(true)} className="rounded-xl border border-[#ECE9E2] bg-white p-3 text-[#647064] cursor-pointer" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-2xl border border-[#ECE9E2] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-[#879086]">{label}</p>
                <p className="mt-2 text-2xl font-black text-[#273126]">{value}</p>
              </div>
              <div className={`rounded-xl p-3 ${color}`}><Icon size={21} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#ECE9E2] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-3 text-[#9CA3AF]" size={17} />
            <input
              className="w-full h-11 rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-3 text-sm font-semibold text-[#273126] outline-none focus:border-[#2E7D32]"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product or category"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              ['expired', `Expired (${expired.length})`],
              ['soon', `Expiring Soon (${soon.length})`],
              ['all', `All Tracked (${tracked.length})`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`rounded-lg px-3 py-2 text-xs font-black ${statusFilter === value ? 'bg-[#1B5E20] text-white' : 'bg-[#F5F3F7] text-[#626B61]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#ECE9E2] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#F8F7F4] text-[10px] font-black uppercase tracking-wider text-[#737B72]">
              <tr>
                {['#', 'Product', 'Category', 'Stock', 'Price', 'Expiry Date', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EEE9]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#6B7280]">
                    {tracked.length === 0
                      ? 'No products have an expiry date set yet. Add one from Inventory → Add / Edit Products.'
                      : 'No items match these filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const isExpired = p.daysLeft < 0
                  const isSoon = !isExpired && p.daysLeft <= alertDays
                  return (
                    <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3.5 align-middle text-[#9CA3AF]">{idx + 1}</td>
                      <td className="max-w-[200px] whitespace-normal break-words px-4 py-3.5 align-middle font-bold text-[#273126]">{p.name}</td>
                      <td className="px-4 py-3.5 align-middle text-[#6B7280] whitespace-nowrap">{p.category || 'General'}</td>
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">{p.stockQuantity ?? p.stock ?? 0}</td>
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">{formatCurrency(p.price || 0)}</td>
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">{new Date(`${p.expiryDate}T00:00:00`).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black ${
                          isExpired ? 'bg-red-100 text-red-700' : isSoon ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isExpired ? `Expired ${Math.abs(p.daysLeft)}d ago` : `Expires in ${p.daysLeft}d`}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
