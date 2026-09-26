import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import { customerService } from '../../services/customerService'
import type { CustomerRecord } from '../../services/customerService'

type PageType = 'calendar' | 'customers'

export default function BirthdayView() {
  const [customers, setCustomers] = React.useState<CustomerRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentPage, setCurrentPage] = useState<PageType>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')

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

  const getDaysWithBirthdays = () => {
    const daysMap = new Map<number, CustomerRecord[]>()
    customers
      .filter(c => c.birthday)
      .forEach(customer => {
        const d = new Date(`${customer.birthday}T00:00:00`)
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
      .filter(c => c.birthday)
      .filter(c => {
        if (!filterFromDate && !filterToDate) return true
        const d = new Date(`${c.birthday}T00:00:00`)
        if (filterFromDate && d < new Date(filterFromDate)) return false
        if (filterToDate && d > new Date(filterToDate)) return false
        return true
      })
  }

  const sendOffer = async (customer: CustomerRecord) => {
    const message = `Hi ${customer.name}! 🎂 Happy Birthday!\n\nHere's a special treat from us:\n20% OFF\n\nEnjoy your special day!`
    try {
      const whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`
      window.open(whatsappUrl, '_blank')
      await customerService.acknowledgeEvent(customer.id, 'birthday')
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

  const daysWithBirthdays = getDaysWithBirthdays()
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const days: (number | null)[] = []

  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const filtered = getFilteredCustomers()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center font-black text-lg">
            🎂
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#273126]">Date of Birth</h2>
            <p className="text-sm text-[#6B7280]">Customer birthdays & one-tap offer sender</p>
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
      </div>

      {/* Calendar Page */}
      {currentPage === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <select value={currentMonth} onChange={(e) => setCurrentMonth(parseInt(e.target.value))} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold">
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'long' })}</option>)}
              </select>
              <select value={currentYear} onChange={(e) => setCurrentYear(parseInt(e.target.value))} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold">
                {Array.from({ length: 5 }, (_, i) => { const year = new Date().getFullYear() - 2 + i; return <option key={year} value={year}>{year}</option> })}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) } else { setCurrentMonth(currentMonth - 1) } }} className="rounded-lg border border-[#E5E7EB] bg-white p-2 hover:bg-gray-50"><ChevronLeft size={18} /></button>
              <button onClick={() => { const today = new Date(); setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()) }} className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold hover:bg-gray-50">Today</button>
              <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) } else { setCurrentMonth(currentMonth + 1) } }} className="rounded-lg border border-[#E5E7EB] bg-white p-2 hover:bg-gray-50"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <div className="mb-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#6B7280]">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, idx) => (
                <div key={idx} className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold ${day === null ? '' : daysWithBirthdays.has(day) ? 'relative border-2 border-pink-500 bg-pink-50 text-[#111111]' : 'border border-[#E5E7EB] text-[#6B7280]'}`}>
                  {day}
                  {day && daysWithBirthdays.has(day) && <div className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-pink-500"></div>}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-[#6B7280]">🔴 Dot = day with birthday</p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <h3 className="mb-3 font-black text-[#273126]">Filter by upcoming birthday</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">FROM</label>
                <input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold" placeholder="dd-mm-yyyy" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">TO</label>
                <input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold" placeholder="dd-mm-yyyy" />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-[#6B7280]">Shows customers whose next birthday falls inside the chosen window.</p>
          </div>
        </div>
      )}

      {/* Customers Page */}
      {currentPage === 'customers' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <h3 className="mb-3 font-black text-[#273126]">Filter by upcoming birthday</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">FROM</label>
                <input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold" placeholder="dd-mm-yyyy" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">TO</label>
                <input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold" placeholder="dd-mm-yyyy" />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-[#6B7280]">Shows customers whose next birthday falls inside the chosen window.</p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F7F4] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-4 py-3 font-black">CUSTOMER</th>
                    <th className="px-4 py-3 font-black">MOBILE</th>
                    <th className="px-4 py-3 font-black">DATE OF BIRTH</th>
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
                        <td className="px-4 py-3 text-[#6B7280]">{new Date(`${customer.birthday}T00:00:00`).toLocaleDateString('en-IN')}</td>
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
