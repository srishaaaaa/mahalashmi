import React, { useCallback, useEffect, useState } from 'react'
import { Wallet, RefreshCw, CheckCircle2, AlertTriangle, IndianRupee } from 'lucide-react'
import { creditService, type OutstandingCreditOrder } from '../../services/creditService'
import { formatCurrency } from '../../lib/retail'
import { useSound } from '../../context/SoundContext'

export interface OutstandingCreditsViewProps {
  onSettled?: () => void
}

export const OutstandingCreditsView: React.FC<OutstandingCreditsViewProps> = ({ onSettled }) => {
  const { play } = useSound()
  const [items, setItems] = useState<OutstandingCreditOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [settlingId, setSettlingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await creditService.fetchOutstandingCredits()
      setItems(data)
    } catch (err) {
      console.error('Failed to load outstanding credits:', err)
      setError('Failed to load outstanding credit sales.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleMarkAsPaid = async (order: OutstandingCreditOrder) => {
    if (!window.confirm(`Mark ${formatCurrency(order.total)} from "${order.customer_name}" (${order.invoice_no}) as paid?`)) {
      return
    }
    setSettlingId(order.id)
    try {
      await creditService.markAsPaid(order.id)
      play('success')
      setItems((prev) => prev.filter((o) => o.id !== order.id))
      onSettled?.()
    } catch (err) {
      console.error('Failed to mark credit as paid:', err)
      play('error')
      alert('Failed to mark this credit sale as paid. Please try again.')
    } finally {
      setSettlingId(null)
    }
  }

  const totalOutstanding = items.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const overdueItems = items.filter((o) => o.daysOverdue > 0)
  const totalOverdue = overdueItems.reduce((sum, o) => sum + Number(o.total || 0), 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-[#B7E1BE] rounded-2xl p-3 sm:p-4 shadow-sm flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#0A0A0A] text-[#2E7D32] flex items-center justify-center font-black shrink-0">
            <Wallet size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-gray-500">Outstanding Invoices</div>
            <div className="text-[15px] sm:text-xl font-black text-black break-words">{items.length}</div>
          </div>
        </div>

        <div className="bg-white border border-[#B7E1BE] rounded-2xl p-3 sm:p-4 shadow-sm flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-black shrink-0">
            <IndianRupee size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-gray-500">Total Outstanding</div>
            <div className="text-[14px] sm:text-lg font-black text-emerald-700 break-words">{formatCurrency(totalOutstanding)}</div>
          </div>
        </div>

        <div className="bg-white border border-[#B7E1BE] rounded-2xl p-3 sm:p-4 shadow-sm flex items-center gap-2.5 sm:gap-3 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center justify-center font-black shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-gray-500">Overdue ({overdueItems.length})</div>
            <div className="text-[14px] sm:text-lg font-black text-red-700 break-words">{formatCurrency(totalOverdue)}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-[#B7E1BE] rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-[#0A0A0A]">Outstanding Credit Sales</h2>
          <p className="text-xs font-semibold text-gray-500">Sales billed on credit that haven't been paid yet</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="shrink-0 p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-gray-400 font-bold text-xs flex flex-col items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-[#2E7D32] mb-2" />
            Loading outstanding credit sales...
          </div>
        ) : error ? (
          <div className="p-16 text-center text-red-500 font-bold text-xs">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-gray-400 font-bold text-xs">
            No outstanding credit sales. Everything's settled!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs whitespace-nowrap">
              <thead className="bg-[#FBFAF6] border-b border-gray-200 text-xs font-bold text-gray-700">
                <tr>
                  <th className="p-3.5">Invoice</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Sale Date</th>
                  <th className="p-3.5">Due Date</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((order) => {
                  const isOverdue = order.daysOverdue > 0
                  const isDueToday = order.daysOverdue === 0
                  return (
                    <tr key={order.id} className="hover:bg-[#FBFAF6] transition-colors">
                      <td className="p-3.5 font-mono font-bold text-gray-800">{order.invoice_no}</td>
                      <td className="p-3.5">
                        <div className="font-black text-gray-900">{order.customer_name}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{order.phone}</div>
                      </td>
                      <td className="p-3.5 text-gray-600 font-semibold">
                        {new Date(order.billing_date || order.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                            isOverdue
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isDueToday
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-50 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {order.credit_due_date ? new Date(`${order.credit_due_date}T00:00:00`).toLocaleDateString('en-IN') : '—'}
                          {isOverdue ? ` (${order.daysOverdue}d overdue)` : isDueToday ? ' (today)' : ''}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-black text-gray-900">{formatCurrency(order.total)}</td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleMarkAsPaid(order)}
                          disabled={settlingId === order.id}
                          className="px-3 py-1.5 rounded-lg bg-[#0A0A0A] border border-[#2E7D32] text-[#2E7D32] text-[11px] font-black hover:bg-[#1A1A1A] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={13} /> {settlingId === order.id ? 'Saving...' : 'Mark as Paid'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
