import { supabase } from '../lib/supabase'

export interface CustomerRecord {
  id: string
  phone: string
  name: string
  address: string
  birthday: string | null
  anniversary: string | null
}

export interface CustomerEvent {
  id: string
  name: string
  phone: string
  type: 'birthday' | 'anniversary'
}

function isTodayMonthDay(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date()
  const d = new Date(`${dateStr}T00:00:00`)
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
}

export const customerService = {
  /**
   * Look up a customer by phone (used to prefill the POS checkout form).
   */
  async findByPhone(phone: string): Promise<CustomerRecord | null> {
    if (!phone.trim()) return null
    const { data, error } = await supabase
      .from('customers')
      .select('id, phone, name, address, birthday, anniversary')
      .eq('phone', phone.trim())
      .maybeSingle()

    if (error) {
      console.error('[customerService.findByPhone] Error:', error)
      return null
    }
    return data
  },

  /**
   * Upsert a customer record from a completed POS sale. Blank birthday/
   * anniversary/name/address never overwrite a previously-saved value —
   * only non-blank fields from this sale are applied.
   */
  async upsertFromSale(input: { phone: string; name?: string; address?: string; birthday?: string | null; anniversary?: string | null }): Promise<void> {
    const phone = input.phone.trim()
    if (!phone) return

    const existing = await this.findByPhone(phone)

    const payload = {
      phone,
      name: input.name?.trim() || existing?.name || '',
      address: input.address?.trim() || existing?.address || '',
      birthday: input.birthday?.trim() || existing?.birthday || null,
      anniversary: input.anniversary?.trim() || existing?.anniversary || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('customers').upsert(payload, { onConflict: 'phone' })
    if (error) {
      console.error('[customerService.upsertFromSale] Error:', error)
    }
  },

  /**
   * Fetch every customer whose birthday or anniversary falls today
   * (year-independent), for the reminder alarm.
   */
  async fetchTodaysEvents(): Promise<CustomerEvent[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, birthday, anniversary')
      .or('birthday.not.is.null,anniversary.not.is.null')

    if (error) {
      console.error('[customerService.fetchTodaysEvents] Error:', error)
      return []
    }

    const events: CustomerEvent[] = []
    for (const row of data || []) {
      if (isTodayMonthDay(row.birthday)) {
        events.push({ id: `${row.id}-birthday`, name: row.name || 'Customer', phone: row.phone, type: 'birthday' })
      }
      if (isTodayMonthDay(row.anniversary)) {
        events.push({ id: `${row.id}-anniversary`, name: row.name || 'Customer', phone: row.phone, type: 'anniversary' })
      }
    }
    return events
  },
}
