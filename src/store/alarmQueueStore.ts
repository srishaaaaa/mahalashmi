import { create } from 'zustand'

export type AlarmId = 'lowStock' | 'expiry'

interface AlarmQueueState {
  /** Alarms currently wanting to show, in the order they asked. Only the front one renders. */
  queue: AlarmId[]
  enqueue: (id: AlarmId) => void
  dequeue: (id: AlarmId) => void
}

/**
 * LowStockAlarmModal and ExpiryAlarmModal are both independent full-screen
 * popups that can each decide, on their own schedule, that they have
 * something to show. Without coordination the later one to mount just
 * paints over the earlier one, hiding it entirely. This queue makes sure
 * only the front alarm renders at a time — the next one appears once the
 * current one is acknowledged.
 */
export const useAlarmQueueStore = create<AlarmQueueState>((set) => ({
  queue: [],
  enqueue: (id) => set((state) => (state.queue.includes(id) ? state : { queue: [...state.queue, id] })),
  dequeue: (id) => set((state) => ({ queue: state.queue.filter((x) => x !== id) })),
}))
