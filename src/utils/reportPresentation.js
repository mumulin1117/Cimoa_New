export const report_date_label = value => Number.isFinite(value)
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  : 'Date unavailable'

export const report_status_label = status => status === 'local_saved' ? 'Saved' : 'Unavailable'
