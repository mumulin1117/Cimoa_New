import { computed } from 'vue'
import { defineStore } from 'pinia'

const make_message = (message_id, sender_id, body, sent_at) => ({ message_id, sender_id, body, sent_at, read: true })
const seed = {
  session: { is_authenticated: true, current_user_id: 'user_hottix', email: 'Hottix@gmail.com' },
  current_user: { user_id: 'user_hottix', user_name: 'Hottix', email: 'Hottix@gmail.com', major: 'Product Design', university: 'Cimoa University', bio: 'Making room for good conversations, small adventures, and better campus days.', avatar_url: '/static/assets/head/me.png', interests: ['Design', 'Coffee', 'Live music', 'Film'], connection_goal: 'Meet new people', coin_balance: 270, verified: true },
  users: [
    { user_id: 'user_maya', user_name: 'Maya Chen', university: 'Cimoa University', major: 'Architecture', distance: '2 km away', avatar_url: '/static/assets/head/maya-card.png', bio: 'Sketching spaces and collecting tiny city stories.', online: true },
    { user_id: 'user_jordan', user_name: 'Jordan Lee', university: 'Cimoa University', major: 'Film Studies', distance: '4 km away', avatar_url: '/static/assets/head/jordan-av.png', bio: 'Always up for a film walk and a good question.', online: false },
    { user_id: 'user_liam', user_name: 'Liam Patel', university: 'Cimoa University', major: 'Computer Science', distance: '5 km away', avatar_url: '/static/assets/head/liam-av.png', bio: 'Building playful tools and looking for people to test them with.', online: true },
    { user_id: 'user_chloe', user_name: 'Chloe Martin', university: 'Cimoa University', major: 'Psychology', distance: '7 km away', avatar_url: '/static/assets/head/maya-av.png', bio: 'Quiet mornings, bright ideas, and shared playlists.', online: true },
  ],
  relationships: [
    { relationship_id: 'rel_maya', from_user_id: 'user_hottix', to_user_id: 'user_maya', status: 'mutual' },
    { relationship_id: 'rel_jordan', from_user_id: 'user_hottix', to_user_id: 'user_jordan', status: 'mutual' },
    { relationship_id: 'rel_liam', from_user_id: 'user_hottix', to_user_id: 'user_liam', status: 'mutual' },
    { relationship_id: 'rel_chloe', from_user_id: 'user_hottix', to_user_id: 'user_chloe', status: 'none' },
  ],
  blocked_user_ids: [], people: [],
  events: [
    { event_id: 'event_picnic', title: 'Sunset Picnic & Polaroids', description: 'A low-pressure evening for photos, snacks, and new faces.', date_label: 'Today · 6:30 PM', location: 'Lakeside lawn', image_url: '/static/assets/img/event-picnic.png', joined: true, participant_count: 24, category: 'Social' },
    { event_id: 'event_forest', title: 'Forest Walk Club', description: 'A gentle weekend walk with a shared playlist.', date_label: 'Sat · 9:00 AM', location: 'North trail gate', image_url: '/static/assets/img/ev-forest.jpg', joined: false, participant_count: 12, category: 'Outdoors' },
    { event_id: 'event_boat', title: 'Boat House Study Break', description: 'Bring a notebook, leave with a new study buddy.', date_label: 'Sun · 3:00 PM', location: 'Old boat house', image_url: '/static/assets/img/ev-boat.jpg', joined: false, participant_count: 18, category: 'Study' },
    { event_id: 'event_camp', title: 'Campus Campfire', description: 'Acoustic sets and warm drinks after dark.', date_label: 'May 18 · 7:30 PM', location: 'East quad', image_url: '/static/assets/img/ev-camp.jpg', joined: false, participant_count: 32, category: 'Music' },
  ],
  posts: [
    { post_id: 'post_maya', author_id: 'user_maya', title: 'The little corners worth finding', body: 'Found a sunlit stairwell between studios. It made the whole afternoon feel slower.', image_url: '/static/assets/img/ev-forest.jpg', liked: false, saved: false, comment_count: 2 },
    { post_id: 'post_jordan', author_id: 'user_jordan', title: 'One question for your next walk', body: 'What would you show someone if you only had twenty minutes on campus?', image_url: '/static/assets/img/ev-bike.jpg', liked: true, saved: true, comment_count: 1 },
  ],
  comments: [
    { comment_id: 'comment_001', post_id: 'post_maya', author_id: 'user_hottix', body: 'Adding this to my route.', created_at: 'Today · 9:20 AM' },
    { comment_id: 'comment_002', post_id: 'post_maya', author_id: 'user_jordan', body: 'The light there is perfect.', created_at: 'Today · 9:27 AM' },
    { comment_id: 'comment_003', post_id: 'post_jordan', author_id: 'user_maya', body: 'The tiny gallery by the library.', created_at: 'Yesterday · 6:10 PM' },
  ],
  conversations: [
    { conversation_id: 'conversation_maya', participant_id: 'user_maya', unread_count: 1, messages: [make_message('m001', 'user_maya', 'Are you going to the picnic later?', 'Today · 5:05 PM'), make_message('m002', 'user_hottix', 'I am! Bringing my camera.', 'Today · 5:11 PM'), make_message('m003', 'user_maya', 'Perfect. See you by the lawn.', 'Today · 5:13 PM')] },
    { conversation_id: 'conversation_jordan', participant_id: 'user_jordan', unread_count: 0, messages: [make_message('j001', 'user_jordan', 'That question from your profile is so good.', 'Yesterday · 4:20 PM'), make_message('j002', 'user_hottix', 'Thank you. I stole it from a friend.', 'Yesterday · 4:32 PM'), make_message('j003', 'user_jordan', 'Then your friend has great taste.', 'Yesterday · 4:35 PM')] },
    { conversation_id: 'conversation_liam', participant_id: 'user_liam', unread_count: 0, messages: [make_message('l001', 'user_liam', 'I tested the campus map idea.', 'Mon · 11:12 AM'), make_message('l002', 'user_hottix', 'How did it feel?', 'Mon · 11:15 AM'), make_message('l003', 'user_liam', 'Much calmer once I removed the noisy bits.', 'Mon · 11:17 AM')] },
  ],
  coin_packages: [
    { package_id: 'pkg_60', coins: 60, price: '$0.99', image_url: '/static/assets/coins/coins-60.png' },
    { package_id: 'pkg_300', coins: 300, price: '$3.99', badge: 'Most popular', image_url: '/static/assets/coins/coins-300.png' },
    { package_id: 'pkg_680', coins: 680, price: '$6.99', image_url: '/static/assets/coins/coins-680.png' },
  ],
  coin_transactions: [
    { transaction_id: 'coin_001', type: 'recharge', amount: 300, balance_after: 300, label: 'Coin pack · Most popular', created_at: 'Yesterday · 2:14 PM', status: 'success' },
    { transaction_id: 'coin_002', type: 'spend', amount: -20, balance_after: 280, label: 'Priority match', created_at: 'Yesterday · 4:42 PM', status: 'success' },
    { transaction_id: 'coin_003', type: 'spend', amount: -10, balance_after: 270, label: 'Voice icebreaker', created_at: 'Today · 8:10 AM', status: 'success' },
  ],
  match: { status: 'idle', preferences: { university: 'Cimoa University', distance: 'Within 5 km', gender: 'Everyone', age_min: 18, age_max: 30 }, candidate_id: 'user_chloe' },
  reports: [], settings: { notifications_enabled: true, show_online_status: true, location_enabled: true, language: 'en-US' },
}
const clone = (value) => JSON.parse(JSON.stringify(value))

export const use_app_store = defineStore('app', {
  state: () => clone(seed),
  getters: {
    current_user_profile: (state) => state.current_user,
    visible_people: (state) => state.users.filter((user) => !state.blocked_user_ids.includes(user.user_id)),
    current_conversations: (state) => state.conversations.filter((item) => !state.blocked_user_ids.includes(item.participant_id)),
    event_count: (state) => state.events.filter((event) => event.joined).length,
    unread_count: (state) => state.conversations.reduce((total, conversation) => total + conversation.unread_count, 0),
    comments_for_post: (state) => (post_id) => state.comments.filter((comment) => comment.post_id === post_id),
    user_by_id: (state) => (user_id) => user_id === state.current_user.user_id ? state.current_user : state.users.find((user) => user.user_id === user_id),
  },
  actions: {
    hydrate() {
      try { const saved = uni.getStorageSync('cimoa_app_state'); if (saved?.current_user) Object.assign(this.$state, saved) } catch { /* Web storage can be unavailable on first launch. */ }
      this.people = this.visible_people
      return this.current_user
    },
    persist() { try { uni.setStorageSync('cimoa_app_state', clone(this.$state)) } catch { /* Best effort in restricted browser contexts. */ } },
    toggle_event_saved(event_id) { const event = this.events.find((item) => item.event_id === event_id); if (!event) return { success: false }; event.saved = !event.saved; this.persist(); return { success: true, event } },
    toggle_post_reaction(post_id, kind) { const post = this.posts.find((item) => item.post_id === post_id); if (!post || !['liked', 'saved'].includes(kind)) return { success: false }; post[kind] = !post[kind]; this.persist(); return { success: true, post } },
    toggle_relationship(user_id) { const relationship = this.relationships.find((item) => item.to_user_id === user_id); if (!relationship) return { success: false }; relationship.status = relationship.status === 'none' ? 'requested' : 'none'; this.persist(); return { success: true, relationship } },
    join_event(event_id) { const event = this.events.find((item) => item.event_id === event_id); if (!event) return { success: false }; event.joined = true; event.participant_count += 1; this.persist(); return { success: true, event } },
    cancel_event(event_id) { const event = this.events.find((item) => item.event_id === event_id); if (!event) return { success: false }; event.joined = false; event.participant_count = Math.max(0, event.participant_count - 1); this.persist(); return { success: true, event } },
    add_comment(post_id, body) { const clean_body = String(body || '').trim(); if (!clean_body || !this.posts.some((post) => post.post_id === post_id)) return { success: false }; const comment = { comment_id: `comment_${Date.now()}`, post_id, author_id: this.current_user.user_id, body: clean_body, created_at: 'Just now' }; this.comments.push(comment); const post = this.posts.find((item) => item.post_id === post_id); post.comment_count = this.comments.filter((item) => item.post_id === post_id).length; this.persist(); return { success: true, comment } },
    send_message(conversation_id, body) { const clean_body = String(body || '').trim(); const conversation = this.conversations.find((item) => item.conversation_id === conversation_id); if (!conversation || !clean_body) return { success: false }; conversation.messages.push(make_message(`message_${Date.now()}`, this.current_user.user_id, clean_body, 'Just now')); conversation.unread_count = 0; this.persist(); return { success: true } },
    block_user(user_id) { if (!this.blocked_user_ids.includes(user_id)) this.blocked_user_ids.push(user_id); this.persist(); return { success: true } },
    unblock_user(user_id) { this.blocked_user_ids = this.blocked_user_ids.filter((id) => id !== user_id); this.persist(); return { success: true } },
    report_user(user_id, reason) { this.reports.push({ report_id: `report_${Date.now()}`, user_id, reason, status: 'submitted', created_at: 'Just now' }); this.persist(); return { success: true } },
    update_profile(patch) { Object.assign(this.current_user, patch); this.persist(); return { success: true } },
    toggle_setting(key) { if (!(key in this.settings)) return { success: false }; this.settings[key] = !this.settings[key]; this.persist(); return { success: true } },
    set_match_status(status) { this.match.status = status; this.persist(); return { success: true } },
    update_match_preferences(patch) { Object.assign(this.match.preferences, patch); this.persist(); return { success: true } },
    spend_coins(kind, label) { const cost = kind === 'priority' ? 20 : 10; if (this.current_user.coin_balance < cost) return { success: false, reason: 'insufficient_coins' }; this.current_user.coin_balance -= cost; this.coin_transactions.unshift({ transaction_id: `coin_${Date.now()}`, type: 'spend', amount: -cost, balance_after: this.current_user.coin_balance, label, created_at: 'Just now', status: 'success' }); this.persist(); return { success: true } },
    complete_purchase(package_id) { const pack = this.coin_packages.find((item) => item.package_id === package_id); if (!pack) return { success: false }; this.current_user.coin_balance += pack.coins; this.coin_transactions.unshift({ transaction_id: `coin_${Date.now()}`, type: 'recharge', amount: pack.coins, balance_after: this.current_user.coin_balance, label: `Coin pack · ${pack.coins}`, created_at: 'Just now', status: 'success' }); this.persist(); return { success: true } },
  },
})

export const use_store_summary = () => {
  const store = use_app_store()
  return { visible_people: computed(() => store.visible_people), conversations: computed(() => store.current_conversations) }
}
