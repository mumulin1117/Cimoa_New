// Source Settings 3711–3765: presentation and exact planned route contracts, not business data.
export const SETTINGS_GROUPS = [
  { title: 'Preferences', rows: [
    ['Notifications', 'bell', 'pink', 'openSetNotif', '/pages/settings/notif'],
    ['Privacy', 'shield', 'purple', 'openSetPrivacy', '/pages/settings/privacy'],
    ['Permissions', 'settings', 'blue', 'openSetPerm', '/pages/settings/perm'],
    ['Language', 'globe', 'purple', 'openSetLang', '/pages/settings/lang'],
  ] },
  { title: 'Safety', rows: [
    ['Blocked Accounts', 'blocked', 'pink', 'openBlockedList', '/pages/settings/blocked'],
    ['Submitted Reports', 'flag', 'purple', 'openReportsSubmitted', '/pages/safety/reports'],
    ['Community Guidelines', 'people', 'blue', 'openAgreeInfo', null],
  ] },
  { title: 'Support', rows: [
    ['Help & Support', 'support', 'blue', 'openSetSupport', '/pages/settings/support'],
    ['Terms & Privacy', 'legal', 'purple', 'openSetLegal', '/pages/settings/legal'],
  ] },
].map(group => ({ ...group, rows: group.rows.map(([label, icon, tone, action, route]) => ({ label, icon, tone, action, route })) }))
