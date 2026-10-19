import { create_scenario } from '../../src/stores/scenarios.js'
import { clone_data } from '../../src/stores/seed.js'
export function organizer_block_fixture(blocked = false, now = Date.now()) {
  const data = create_scenario('event_joined', now), picnic = data.events.find(e => e.event_id === 'event_picnic')
  // Isolated fixtures keep this attendance open at any execution hour. No
  // production dates, real user's preferences or organizer records are changed.
  Object.assign(picnic, { starts_at: now, ends_at: now + 7200000 })
  data.organizers.push({ organizer_id: 'organizer_other', name: 'Other Campus Society', avatar_url: '' })
  data.events.push({ ...clone_data(picnic), event_id: 'event_other', title: 'Other campus meetup', organizer_id: 'organizer_other', featured_tab: null, feed_order: 2.5 })
  for (const message of data.messages) if (!message.read_by.includes(data.session.current_user_id)) message.read_by.push(data.session.current_user_id)
  if (blocked) data.event_preferences[0].blocked_organizer_ids = ['organizer_hkust']
  return { data, now }
}
