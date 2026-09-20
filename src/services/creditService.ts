import { supabase } from '../lib/supabase'

export interface OutstandingCreditOrder {
  id: string
  invoice_no: string
  customer_name: string
  phone: string
  total: number
  created_at: string
  billing_date: string | null
  credit_due_date: string | null
  daysOverdue: number
}

const OUTSTANDING_COLUMNS = 'id, invoice_no, customer_name, phone, total, created_at, billing_date, credit_due_date'

function toDaysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((today.getTime() - due.getTime()) / msPerDay)
}

export const creditService = {
  /**
   * Fetch every outstanding (unpaid) credit sale, oldest due date first.
   */
  async fetchOutstandingCredits(): Promise<OutstandingCreditOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(OUTSTANDING_COLUMNS)
      .eq('credit_status', 'outstanding')
      .order('credit_due_date', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('[creditService.fetchOutstandingCredits] Error:', error)
      throw error
    }

    return (data || []).map((row) => ({
      ...row,
      daysOverdue: toDaysOverdue(row.credit_due_date),
    }))
  },

  /**
   * Lightweight count of outstanding credit sales whose due date has arrived
   * or passed, for the sidebar badge.
   */
  async fetchOverdueCount(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10)
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('credit_status', 'outstanding')
      .lte('credit_due_date', today)

    if (error) {
      console.error('[creditService.fetchOverdueCount] Error:', error)
      return 0
    }

    return count || 0
  },

  /**
   * Settle an outstanding credit sale: marks it paid and stamps when.
   */
  async markAsPaid(orderId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_credit_order_paid', { p_order_id: orderId })
    if (error) {
      console.error('[creditService.markAsPaid] Error:', error)
      throw error
    }
  },
}
