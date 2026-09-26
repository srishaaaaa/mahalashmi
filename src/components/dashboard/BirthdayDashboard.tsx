import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, MessageCircle, Gift } from 'lucide-react'
import { customerService, type CustomerRecord } from '../../services/customerService'
import { formatCurrency } from '../../lib/retail'

type EventType = 'birthday' | 'anniversary'

export default function BirthdayDashboard() {
  const [customers, setCustomers] = React.useState<CustomerRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedEventType, setSelectedEventType] = useState<EventType>('birthday')
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [offerType, setOfferType] = useState<EventType>('birthday')
  const [selectedOffer, setSelectedOffer] = useState('20% OFF')

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

  const getEventDates = (eventType: EventType) => {
    const dateField = eventType === 'birthday' ? 'birthday' : 'anniversary'
    return customers
      .filter(c => c[dateField as keyof CustomerRecord])
      .map(c => ({
        customer: c,
        date: c[dateField as keyof CustomerRecord] as string,
      }))
  }

  const getDaysWithEvents = (eventType: EventType) => {
    const dates = getEventDates(eventType)
    const daysMap = new Map<number, CustomerRecord[]>()

    dates.forEach(({ customer, date }) => {
      const d = new Date(`${date}T00:00:00`)
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const day = d.getDate()
        if (!daysMap.has(day)) daysMap.set(day, [])
        daysMap.get(day)?.push(customer)
      }
    })
    return daysMap
  }

  const getFilteredCustomers = (eventType: EventType) => {
    const dateField = eventType === 'birthday' ? 'birthday' : 'anniversary'
    return customers
      .filter(c => c[dateField as keyof CustomerRecord])
      .filter(c => {
        if (!filterFromDate && !filterToDate) return true
        const d = new Date(`${c[dateField as keyof CustomerRecord]}T00:00:00`)
        if (filterFromDate) {
          const from = new Date(filterFromDate)
          if (d < from) return false
        }
        if (filterToDate) {
          const to = new Date(filterToDate)
          if (d > to) return false
        }
        return true
      })
  }

  const sendOffer = async (customer: CustomerRecord) => {
    const eventType = offerType === 'birthday' ? 'birthday' : 'anniversary'
    const message = `Hi ${customer.name}! 🎉 Happy ${eventType}!\n\nHere's a special treat from us:\n${selectedOffer}\n\nEnjoy your special day!`

    try {
      const whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`
      window.open(whatsappUrl, '_blank')
      await customerService.acknowledgeEvent(customer.id, eventType as 'birthday' | 'anniversary')
    } catch (err) {
      console.error('Failed to send offer')
    }
  }

  const renderCalendar = (eventType: EventType) => {
    const daysWithEvents = getDaysWithEvents(eventType)
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const days = []

    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)

    return (
      <div className="space-y-4">
        {/* Month/Year Selector */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value))}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (currentMonth === 0) {
                  setCurrentMonth(11)
                  setCurrentYear(currentYear - 1)
                } else {
                  setCurrentMonth(currentMonth - 1)
                }
              }}
              className="rounded-lg border border-[#E5E7EB] bg-white p-2 hover:bg-gray-50"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => {
                const today = new Date()
                setCurrentMonth(today.getMonth())
                setCurrentYear(today.getFullYear())
              }}
              className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={() => {
                if (currentMonth === 11) {
                  setCurrentMonth(0)
                  setCurrentYear(currentYear + 1)
                } else {
                  setCurrentMonth(currentMonth + 1)
                }
              }}
              className="rounded-lg border border-[#E5E7EB] bg-white p-2 hover:bg-gray-50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="mb-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#6B7280]">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => (
              <div
                key={idx}
                className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold ${
                  day === null
                    ? ''
                    : daysWithEvents.has(day)
                    ? 'relative border-2 border-pink-500 bg-pink-50 text-[#111111]'
                    : 'border border-[#E5E7EB] text-[#6B7280]'
                }`}
              >
                {day}
                {day && daysWithEvents.has(day) && (
                  <div className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-pink-500"></div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[#6B7280]">
            🔴 Dot = day with {eventType}
          </p>
        </div>

        {/* Filter */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <h3 className="mb-3 font-black text-[#273126]">Filter by upcoming {eventType}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[#6B7280] mb-1">FROM</label>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                placeholder="dd-mm-yyyy"
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6B7280] mb-1">TO</label>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                placeholder="dd-mm-yyyy"
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold"
              />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-[#6B7280]">
            Shows customers whose next {eventType} falls inside the chosen window.
          </p>
        </div>
      </div>
    )
  }

  const renderCustomerList = (eventType: EventType) => {
    const filtered = getFilteredCustomers(eventType)
    const dateField = eventType === 'birthday' ? 'birthday' : 'anniversary'

    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F7F4] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-4 py-3 font-black">CUSTOMER</th>
                <th className="px-4 py-3 font-black">MOBILE</th>
                <th className="px-4 py-3 font-black uppercase">{eventType === 'birthday' ? 'Date of Birth' : 'Anniversary Date'}</th>
                <th className="px-4 py-3 font-black">SPENT</th>
                <th className="px-4 py-3 font-black">OFFER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#6B7280]">
                    No customers match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => {
                  const date = customer[dateField as keyof CustomerRecord] as string
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-[#111111]">{customer.name}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{customer.phone}</td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {new Date(`${date}T00:00:00`).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-black text-[#111111]">₹0</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setOfferType(eventType)
                            sendOffer(customer)
                          }}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[10px] font-black text-white cursor-pointer"
                        >
                          <MessageCircle size={12} /> SEND OFFER
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Birthday Section */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center font-black">
            🎂
          </div>
          <div>
            <h2 className="text-xl font-black text-[#273126]">Date of Birth</h2>
            <p className="text-sm text-[#6B7280]">Customer birthdays & one-tap offer sender</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div>{renderCalendar('birthday')}</div>
          <div>{renderCustomerList('birthday')}</div>
        </div>
      </div>

      {/* Anniversary Section */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-black">
            💍
          </div>
          <div>
            <h2 className="text-xl font-black text-[#273126]">Anniversaries</h2>
            <p className="text-sm text-[#6B7280]">Customer anniversaries & one-tap offer sender</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div>{renderCalendar('anniversary')}</div>
          <div>{renderCustomerList('anniversary')}</div>
        </div>
      </div>
    </div>
  )
}
