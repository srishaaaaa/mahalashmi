import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import { customerService } from '../../services/customerService'
import type { CustomerRecord } from '../../services/customerService'

type PageType = 'calendar' | 'customers'

export default function AnniversaryView() {
  const [customers, setCustomers] = React.useState<CustomerRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentPage, setCurrentPage] = useState<PageType>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [selectedOffer, setSelectedOffer] = useState('20% OFF')
  const [customMessage, setCustomMessage] = useState('')
  const [offers, setOffers] = useState(['20% OFF', 'Buy 1 Get 1', '₹500 OFF', 'Free Gift'])
  const [editingOffer, setEditingOffer] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  React.useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await customerService.fetchAll()
        setCustomers(data)
      } catch (err) {
        console.error('Failed to load customers')
      } finally {
        setLoading(false)
      }
    }
    loadCustomers()
  }, [])

  const getDaysWithAnniversaries = () => {
    const daysMap = new Map<number, CustomerRecord[]>()
    customers
      .filter(c => c.anniversary)
      .forEach(customer => {
        const d = new Date(`${customer.anniversary}T00:00:00`)
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          const day = d.getDate()
          if (!daysMap.has(day)) daysMap.set(day, [])
          daysMap.get(day)?.push(customer)
        }
      })
    return daysMap
  }

  const getFilteredCustomers = () => {
    return customers
      .filter(c => c.anniversary)
      .filter(c => {
        if (!filterFromDate && !filterToDate) return true
        const d = new Date(`${c.anniversary}T00:00:00`)
        if (filterFromDate && d < new Date(filterFromDate)) return false
        if (filterToDate && d > new Date(filterToDate)) return false
        return true
      })
  }

  const sendOffer = async (customer: CustomerRecord) => {
    const message = customMessage || `Hi ${customer.name}! 💍 Happy Anniversary!\n\nHere's a special treat from us:\n${selectedOffer}\n\nEnjoy your special day!`
    try {
      const whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`
      window.open(whatsappUrl, '_blank')
      await customerService.acknowledgeEvent(customer.id, 'anniversary')
    } catch (err) {
      console.error('Failed to send offer')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
      </div>
    )
  }

  const daysWithAnniversaries = getDaysWithAnniversaries()
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const days: (number | null)[] = []

  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const filtered = getFilteredCustomers()
  const previewMessage = customMessage || `Hi Aarav! 💍 Happy Anniversary!\n\nHere's a special treat from Shalistone:\n🎁 ${selectedOffer}\n\nShop online at www.example.com or visit us in store.\nFollow us on Instagram @shalistone\n\n– Shalistone · Kids & Mens Fashion`

  const handleEditOffer = (offer: string) => {
    setEditingOffer(offer)
    setEditingValue(offer)
  }

  const handleSaveEdit = () => {
    if (editingOffer && editingValue) {
      setOffers(offers.map(o => o === editingOffer ? editingValue : o))
      if (selectedOffer === editingOffer) {
        setSelectedOffer(editingValue)
      }
      setEditingOffer(null)
    }
  }

  const handleDeleteOffer = (offer: string) => {
    setOffers(offers.filter(o => o !== offer))
    if (selectedOffer === offer && offers.length > 1) {
      setSelectedOffer(offers[0])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-black text-lg">
          💍
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#273126]">Anniversaries</h2>
          <p className="text-sm text-[#6B7280]">Customer anniversaries & one-tap offer sender</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[#E5E7EB]">
        <button
          onClick={() => setCurrentPage('calendar')}
          className={`px-4 py-3 font-bold text-sm transition-colors ${
            currentPage === 'calendar'
              ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]'
              : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setCurrentPage('customers')}
          className={`px-4 py-3 font-bold text-sm transition-colors ${
            currentPage === 'customers'
              ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]'
              : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          Customers
        </button>
      </div>

      {/* Calendar Page */}
      {currentPage === 'calendar' && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left Sidebar - Calendar & Filter */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex gap-1">
                  <select value={currentMonth} onChange={(e) => setCurrentMonth(parseInt(e.target.value))} className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-xs font-bold">
                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'short' })}</option>)}
                  </select>
                  <select value={currentYear} onChange={(e) => setCurrentYear(parseInt(e.target.value))} className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-xs font-bold">
                    {Array.from({ length: 5 }, (_, i) => { const year = new Date().getFullYear() - 2 + i; return <option key={year} value={year}>{year}</option> })}
                  </select>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) } else { setCurrentMonth(currentMonth - 1) } }} className="rounded border border-[#E5E7EB] bg-white p-1 hover:bg-gray-50"><ChevronLeft size={14} /></button>
                  <button onClick={() => { const today = new Date(); setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()) }} className="rounded border border-[#E5E7EB] bg-white px-2 py-1 text-[10px] font-bold hover:bg-gray-50">Today</button>
                  <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) } else { setCurrentMonth(currentMonth + 1) } }} className="rounded border border-[#E5E7EB] bg-white p-1 hover:bg-gray-50"><ChevronRight size={14} /></button>
                </div>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-[#6B7280]">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => <div key={day}>{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day, idx) => (
                  <div key={idx} className={`h-6 flex items-center justify-center rounded text-[10px] font-bold ${day === null ? '' : daysWithAnniversaries.has(day) ? 'relative border border-rose-500 bg-rose-50 text-[#111111]' : 'border border-[#E5E7EB] text-[#6B7280]'}`}>
                    {day}
                    {day && daysWithAnniversaries.has(day) && <div className="absolute bottom-0.5 h-0.5 w-0.5 rounded-full bg-rose-500"></div>}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[9px] text-[#6B7280]">🔴 Dot = anniversary</p>
            </div>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3">
              <h3 className="mb-2 font-bold text-xs text-[#273126]">Filter by date</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-[9px] font-bold text-[#6B7280] mb-0.5">FROM</label>
                  <input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[10px] font-semibold" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-[#6B7280] mb-0.5">TO</label>
                  <input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[10px] font-semibold" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Main - Anniversary Message Config */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E5E7EB] bg-rose-50 p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-200 flex items-center justify-center font-bold text-lg">🎁</div>
                <div>
                  <h3 className="font-bold text-[#273126]">Anniversary Offer Message</h3>
                  <p className="text-xs text-[#6B7280]">Sent on WhatsApp when you tap "Send Offer".</p>
                </div>
              </div>

              <div className="mb-4 space-y-2">
                <label className="block text-xs font-bold text-[#6B7280]">SELECT OFFER</label>
                {editingOffer ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="w-full rounded-lg border border-rose-500 bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="Enter offer text"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 px-3 py-2 rounded-lg bg-rose-500 text-white font-bold text-sm hover:bg-rose-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingOffer(null)}
                        className="flex-1 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#111111] font-bold text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={selectedOffer}
                      onChange={(e) => setSelectedOffer(e.target.value)}
                      className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {offers.map((offer) => (
                        <option key={offer} value={offer}>{offer}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleEditOffer(selectedOffer)}
                      className="px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white font-bold text-sm hover:bg-gray-50 transition-colors"
                      title="Edit selected offer"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteOffer(selectedOffer)}
                      className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 font-bold text-sm text-red-700 transition-colors"
                      title="Delete selected offer"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-[#6B7280] mb-2">CUSTOMIZE MESSAGE</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Leave blank to use default message"
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  rows={3}
                />
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-bold text-[#6B7280] mb-2 text-center">MESSAGE PREVIEW</p>
                <div className="text-sm text-[#111111] whitespace-pre-wrap leading-relaxed">
                  {previewMessage}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customers Page */}
      {currentPage === 'customers' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <h3 className="mb-3 font-bold text-[#273126] text-sm">Filter by upcoming anniversary</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">FROM</label>
                <input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">TO</label>
                <input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F7F4] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-4 py-3 font-black">CUSTOMER</th>
                    <th className="px-4 py-3 font-black">MOBILE</th>
                    <th className="px-4 py-3 font-black">ANNIVERSARY DATE</th>
                    <th className="px-4 py-3 font-black">SPENT</th>
                    <th className="px-4 py-3 font-black">OFFER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#6B7280]">No customers match the selected filters.</td>
                    </tr>
                  ) : (
                    filtered.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-[#111111]">{customer.name}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{customer.phone}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{new Date(`${customer.anniversary}T00:00:00`).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 font-black text-[#111111]">₹0</td>
                        <td className="px-4 py-3">
                          <button onClick={() => sendOffer(customer)} className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[10px] font-black text-white cursor-pointer">
                            <MessageCircle size={12} /> SEND OFFER
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
