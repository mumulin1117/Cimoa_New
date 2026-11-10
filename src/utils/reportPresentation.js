export const report_date_label = value => Number.isFinite(value)
  ? new Intl.DateTimeFormat(get_locale(), { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  : 'Date unavailable'

export const report_status_label = status => status === 'local_saved' ? 'Not delivered' : 'Unavailable'
import { get_locale } from '../i18n/index.js'
