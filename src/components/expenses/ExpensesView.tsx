import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Download,
  Plus,
  Trash2,
  Calendar,
  Receipt,
  RefreshCw,
  TrendingDown,
  Layers,
  Search,
  X,
  Filter,
} from 'lucide-react'
import {
  expenseService,
  exportExpensesToCSV,
  type ExpenseCategory,
  type ExpenseRecord,
  type ExpenseSummaryMetrics,
} from '../../services/expenseService'
import { RecordExpenseModal } from './RecordExpenseModal'
import { ExpenseCategoriesView } from './ExpenseCategoriesView'

export const ExpensesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses')
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)

  // Metrics
  const [metrics, setMetrics] = useState<ExpenseSummaryMetrics>({
    today: 0,
    this_week: 0,
    this_month: 0,
    this_year: 0,
    total_all_time: 0,
  })

  // Data & Categories
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [activePreset, setActivePreset] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadMetrics = useCallback(async () => {
    try {
      const data = await expenseService.getMetrics()
      setMetrics(data)
    } catch (err) {
      console.warn('Failed to load expense metrics:', err)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const cats = await expenseService.getCategories()
      setCategories(cats)
    } catch (err) {
      console.warn('Failed to load categories:', err)
    }
  }, [])

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const data = await expenseService.getExpenses({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : undefined,
      })
      setExpenses(data)
    } catch (err) {
      console.error('Failed to load expenses:', err)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, selectedCategoryId])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMetrics(), loadCategories(), loadExpenses()])
  }, [loadMetrics, loadCategories, loadExpenses])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  // Filter expenses list by search query
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses
    const q = searchQuery.toLowerCase().trim()
    return expenses.filter(
      (e) =>
        e.description?.toLowerCase().includes(q) ||
        e.category_name?.toLowerCase().includes(q) ||
        e.payment_mode?.toLowerCase().includes(q) ||
        e.recorded_by_name?.toLowerCase().includes(q) ||
        String(e.amount).includes(q)
    )
  }, [expenses, searchQuery])

  // Handle Preset Clicks (Synchronizes FROM and TO dates)
  const applyDatePreset = (preset: 'all' | 'today' | 'week' | 'month') => {
    setActivePreset(preset)
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    if (preset === 'all') {
      setFromDate('')
      setToDate('')
    } else if (preset === 'today') {
      setFromDate(todayStr)
      setToDate(todayStr)
    } else if (preset === 'week') {
      const dayOfWeek = (today.getDay() + 6) % 7
      const monday = new Date(today)
      monday.setDate(today.getDate() - dayOfWeek)
      setFromDate(monday.toISOString().slice(0, 10))
      setToDate(todayStr)
    } else if (preset === 'month') {
      const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
      setFromDate(monthStart)
      setToDate(todayStr)
    }
  }

  const resetAllFilters = () => {
    setFromDate('')
    setToDate('')
    setActivePreset('all')
    setSelectedCategoryId('all')
    setSearchQuery('')
  }


  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Delete this expense record?')) return
    try {
      await expenseService.deleteExpense(id)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      void loadMetrics()
    } catch (err) {
      console.error('Failed to delete expense:', err)
      alert('Could not delete expense record')
    }
  }

  const handleExpenseSaved = (newExpense: ExpenseRecord) => {
    setExpenses((prev) => [newExpense, ...prev])
    void loadMetrics()
  }

  const formatCurrencyValue = (val: number) => {
    return `₹ ${Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#0A0A0A] flex items-center gap-2">
            <Receipt size={22} className="text-[#2E7D32]" />
            Expense Tracker
          </h2>
          <p className="text-xs text-gray-500 font-bold mt-0.5">
            Monitor store overheads, operating costs, and categorized expenses
          </p>
        </div>

        {/* View Switch Pills */}
        <div className="flex items-center gap-2 bg-[#FBFAF6] p-1.5 rounded-2xl border border-[#B7E1BE]">
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-[#0A0A0A] text-[#2E7D32] shadow-sm'
                : 'text-gray-700 hover:text-black'
            }`}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-[#0A0A0A] text-[#2E7D32] shadow-sm'
                : 'text-gray-700 hover:text-black'
            }`}
          >
            Categories
          </button>
        </div>
      </div>

      {activeTab === 'categories' ? (
        <ExpenseCategoriesView
          categories={categories}
          onCategoriesUpdated={() => {
            void loadCategories()
            void loadExpenses()
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* 5 KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {[
              { label: 'Today', value: metrics.today },
              { label: 'This Week', value: metrics.this_week },
              { label: 'This Month', value: metrics.this_month },
              { label: 'This Year', value: metrics.this_year },
              { label: 'Total All Time', value: metrics.total_all_time },
            ].map((kpi, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-[#2E7D32]/50 transition-all group"
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[11px] font-bold text-gray-500">
                    {kpi.label}
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-[#FBFAF6] border border-[#B7E1BE]/60 flex items-center justify-center text-[#2E7D32] group-hover:scale-105 transition-transform">
                    <TrendingDown size={13} />
                  </div>
                </div>
                <div className="text-base sm:text-lg font-black text-[#0A0A0A] tracking-tight">
                  {formatCurrencyValue(kpi.value)}
                </div>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
            {/* Top Row: Date Presets & Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Date Filters & Presets */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value)
                        setActivePreset('all')
                      }}
                      className="h-10 pl-8 pr-2.5 rounded-xl border border-gray-300 bg-[#FAFAFA] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                    />
                    <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  <span className="text-xs font-bold text-gray-400">to</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setToDate(e.target.value)
                        setActivePreset('all')
                      }}
                      className="h-10 pl-8 pr-2.5 rounded-xl border border-gray-300 bg-[#FAFAFA] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                    />
                    <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Preset Buttons */}
                <div className="flex items-center gap-1.5 bg-[#FAFAFA] p-1 rounded-xl border border-gray-200">
                  {(['all', 'today', 'week', 'month'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyDatePreset(p)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        activePreset === p
                          ? 'bg-[#0A0A0A] text-[#2E7D32] shadow-xs'
                          : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      {p === 'all' ? 'All Time' : p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'Month'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void refreshAll()}
                  title="Refresh Expenses"
                  className="h-10 w-10 rounded-xl border border-gray-300 bg-white flex items-center justify-center text-gray-600 hover:text-black hover:border-black transition-all cursor-pointer"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => exportExpensesToCSV(filteredExpenses)}
                  disabled={filteredExpenses.length === 0}
                  className="h-10 px-4 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 hover:bg-gray-100 transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-40"
                >
                  <Download size={14} /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(true)}
                  className="h-10 px-4 rounded-xl bg-[#0A0A0A] border border-[#2E7D32] text-[#2E7D32] text-xs font-bold hover:bg-[#1A1A1A] transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={15} /> Record Expense
                </button>
              </div>
            </div>

            {/* Bottom Row: Category Dropdown & Keyword Search Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-gray-100">
              {/* Category Dropdown */}
              <div className="sm:col-span-4 lg:col-span-3">
                <div className="relative">
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full h-10 pl-9 pr-8 rounded-xl border border-gray-300 bg-[#FAFAFA] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] cursor-pointer appearance-none"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">
                    ▼
                  </div>
                </div>
              </div>

              {/* Text Search Box */}
              <div className="sm:col-span-8 lg:col-span-9 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by description, category, staff name, or amount..."
                    className="w-full h-10 pl-9 pr-9 rounded-xl border border-gray-300 bg-[#FAFAFA] text-xs font-medium text-gray-900 outline-none focus:border-[#0A0A0A]"
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {(selectedCategoryId !== 'all' || searchQuery || fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:text-black hover:bg-gray-100 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-gray-100 bg-[#FAFAFA] flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-800">
                Expense Records ({filteredExpenses.length})
              </h4>
              {selectedCategoryId !== 'all' && (
                <span className="text-[11px] font-bold text-gray-500">
                  Filtered by Category:{' '}
                  <span className="text-gray-900">
                    {categories.find((c) => String(c.id) === String(selectedCategoryId))?.name || selectedCategoryId}
                  </span>
                </span>
              )}
            </div>

            <div className="md:hidden rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden bg-white">
              {loading ? (
                <div className="px-5 py-10 text-center text-gray-400 font-bold text-xs">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#2E7D32]" />
                  Loading expenses...
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 font-bold text-xs">
                  <Layers size={32} className="mx-auto mb-2 opacity-30" />
                  No expense records found matching the filters.
                </div>
              ) : (
                filteredExpenses.map((exp) => (
                  <div key={exp.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-[13px] break-words">{exp.category_name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 break-words">
                        {exp.expense_date}{exp.description ? ` · ${exp.description}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="font-black text-sm text-[#0A0A0A]">{formatCurrencyValue(exp.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)}
                        title="Delete record"
                        className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-500 inline-flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-[#FBFAF6]">
                    <th className="px-5 py-3.5 text-[11px] font-bold text-gray-600">
                      Date
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-gray-600">
                      Category
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-gray-600">
                      Description
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-gray-600 text-right">
                      Amount (₹)
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-gray-600 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-gray-400 font-bold">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#2E7D32]" />
                        Loading expenses...
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-gray-400 font-bold">
                        <Layers size={32} className="mx-auto mb-2 opacity-30" />
                        No expense records found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                          {exp.expense_date}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#FBFAF6] text-[#0A0A0A] border border-[#B7E1BE]">
                            {exp.category_name}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 max-w-[280px] break-words">
                          {exp.description || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-sm text-[#0A0A0A] whitespace-nowrap">
                          {formatCurrencyValue(exp.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="Delete record"
                            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-500 inline-flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Record Expense Modal */}
          <RecordExpenseModal
            isOpen={isRecordModalOpen}
            onClose={() => setIsRecordModalOpen(false)}
            onSuccess={handleExpenseSaved}
            categories={categories}
          />
        </div>
      )}
    </div>
  )
}
