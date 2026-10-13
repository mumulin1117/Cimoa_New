import { defineStore } from 'pinia'

const seed = {
  current_user: { user_id: 'user_001', user_name: 'Mia Chen', major: 'Product Design', avatar_url: '', coin_balance: 248 },
  upcoming_events: [
    { event_id: 'event_001', title: 'Sunday Sketch Club', meta: 'Today · 6:30 PM', location: 'Studio 04', accent: 'lime' },
    { event_id: 'event_002', title: 'Campus Film Night', meta: 'Sat · 8:00 PM', location: 'The Commons', accent: 'lavender' }
  ],
  people: [
    { user_id: 'user_002', user_name: 'Jordan Lee', detail: 'Architecture · 2 km away', initials: 'JL', avatar_tone: 'rose' },
    { user_id: 'user_003', user_name: 'Sam Rivera', detail: 'Computer Science · 5 km away', initials: 'SR', avatar_tone: 'sage' },
    { user_id: 'user_004', user_name: 'Avery Kim', detail: 'Film Studies · 3 km away', initials: 'AK', avatar_tone: 'lilac' }
  ]
}

export const use_app_store = defineStore('app', {
  state: () => structuredClone(seed),
  actions: {
    hydrate() { return this.current_user },
    toggle_saved_event(event_id) {
      const event = this.upcoming_events.find((item) => item.event_id === event_id)
      if (event) event.saved = !event.saved
      return { success: Boolean(event) }
    }
  }
})
