import { create_auth_notice_controller } from './authFeedback.js'
import { clear_toast } from './toast.js'

export const auth_notice = create_auth_notice_controller({ on_start: clear_toast })
// Auth and business operations share one controlled presentation host.
export const action_notice = auth_notice
export const clear_auth_notice = () => auth_notice.clear()
