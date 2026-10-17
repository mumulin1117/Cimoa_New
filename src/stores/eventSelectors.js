import { authenticated, owner_id, user_by_id, members, joined, visible, social_eligible } from './selectors.js'
import { clone_data } from './seed.js'

export const EVENT_TABS = Object.freeze([
  { label: 'Today', interaction_id: 'events.chipToday.click.1' },
  { label: 'This week', interaction_id: 'events.chipWeek.click.1' },
  { label: 'My campus', interaction_id: 'events.chipCampus.click.1' },
])
export const EVENT_REPORT_REASONS = Object.freeze(['Misleading event information', 'Unsafe activity', 'Harassment or discrimination', 'Inappropriate content', 'Spam or scam', 'Underage safety concern', 'Other'])
export const active_event_tab = data => data.event_preferences.find(row => row.owner_user_id === owner_id(data))?.active_tab || 'Today'
const date_key = (time, zone) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(time).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
const date_day = (time, zone) => Math.floor(Date.parse(date_key(time, zone) + 'T00:00:00Z') / 86400000)
export function event_card(data, event, now) {
  const zone = event.time_zone || 'UTC'
  const day = date_day(event.starts_at, zone), today = date_day(now, zone)
  const day_label = day === today ? 'Today' : day === today + 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { timeZone: zone, ...(day > today && day < today + 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }) }).format(event.starts_at)
  const time = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(event.starts_at)
  const attendees = members(data, event.event_id)
  const participants = attendees.filter(row => visible(data, row.user_id)).map(row => user_by_id(data, row.user_id))
  return { ...clone_data(event), joined: joined(data, event.event_id), participant_count: participants.length,
    participants: clone_data(participants.slice(0, 4)), available_count: Math.max(0, event.capacity - attendees.length),
    date_label: `${day_label} · ${time}`, time_zone_label: zone,
    conversation_id: joined(data, event.event_id) ? data.conversations.find(row => row.kind === 'group' && row.event_id === event.event_id)?.conversation_id || null : null }
}
export function event_feed(data, now) {
  const tab = active_event_tab(data), campus = user_by_id(data, owner_id(data))?.university
  return data.events.filter(event => {
    if (event.ends_at <= now) return false
    if (tab === 'My campus') return !!campus && event.university === campus
    const zone = event.time_zone || 'UTC', today = date_day(now, zone), day = date_day(event.starts_at, zone)
    if (tab === 'Today') return day === today
    const monday = today - ((new Date(today * 86400000).getUTCDay() + 6) % 7)
    return day >= monday && day < monday + 7
  }).sort((a, b) => Number(b.featured_tab === tab) - Number(a.featured_tab === tab) || (a.feed_order ?? a.starts_at) - (b.feed_order ?? b.starts_at))
    .map(event => event_card(data, event, now))
}
export function event_join_blocker(data, id, now) {
  if (!authenticated(data, now)) return 'Your session has expired. Please sign in again.'
  if (!social_eligible(data)) return 'Complete account verification and profile setup first.'
  const event = data.events.find(row => row.event_id === id)
  if (!event) return 'This event is no longer available.'
  if (event.ends_at <= now) return 'This event has ended.'
  if (joined(data, id)) return 'You have already joined this event.'
  if (members(data, id).length >= event.capacity) return 'This event is full.'
  // Paid-event checkout is not part of the source join flow. Never silently charge or waive it.
  if (event.price !== 0) return 'Paid event booking is not configured. No changes were made.'
  return ''
}
export function event_detail(data, id, now) {
  const source = data.events.find(row => row.event_id === id)
  if (!source) return null
  const event = event_card(data, source, now), zone = event.time_zone || 'UTC'
  const clock = value => new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(value)
  const organizer = data.organizers.find(row => row.organizer_id === event.organizer_id)
  const notes = [...new Set([event.price === 0 ? 'Free to join' : null, ...(event.notes || '').split(/\.\s*/).filter(Boolean), event.accessibility, event.weather_plan].filter(Boolean))]
  const note_icons = { 'Free to join': '🆓', 'Bring a picnic mat': '🧺', 'English & Cantonese': '🗣️', 'Step-free access': '♿', 'Moves indoors if it rains': '🌧️' }
  return { ...event, organizer: organizer ? { ...clone_data(organizer), badge_label: organizer.badge_label || (organizer.name.endsWith('Student Union') ? 'SU' : organizer.name.split(/\s+/).map(word => word[0]).slice(0, 2).join('')) } : null, ended: event.ends_at <= now,
    attendance_label: `${event.participant_count} of ${event.capacity} going`,
    schedule: (event.schedule || []).map(item => ({ ...item, time_label: clock(event.starts_at + item.offset_minutes * 60000) })),
    notes, note_chips: notes.map(label => ({ label, emoji: note_icons[label] || '' })),
    share_text: [event.title, `${event.date_label} (${zone})`, event.location, event.description].filter(Boolean).join('\n') }
}
export function my_event_groups(data, now) {
  const rows = data.events.filter(row => joined(data, row.event_id)).map(row => event_card(data, row, now))
  const future = rows.filter(row => row.ends_at > now).sort((a,b) => a.starts_at - b.starts_at)
  const featured = future.shift() || null, week = [], later = []
  for (const event of future) {
    const zone = event.time_zone || 'UTC', today = date_day(now, zone), monday = today - ((new Date(today * 86400000).getUTCDay() + 6) % 7)
    ;(date_day(event.starts_at, zone) < monday + 7 ? week : later).push(event)
  }
  return { featured, sections: [
    { label: 'This week', interaction_id: 'evUpcoming.openJoined.click.2', events: week },
    { label: 'Later', interaction_id: 'evUpcoming.openJoined.click.3', events: later },
    { label: 'Past', interaction_id: 'evUpcoming.openJoined.click.4', events: rows.filter(row => row.ends_at <= now).sort((a,b) => b.starts_at - a.starts_at) },
  ].filter(section => section.events.length) }
}
