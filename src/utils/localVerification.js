import { LOCAL_VERIFICATION_CODE } from '../config/local-auth.js'

export const valid_local_code = value => typeof value === 'string' && value === LOCAL_VERIFICATION_CODE
export function local_verification_context(data, now) {
  const session = data.session
  const active = session.account_id && session.current_user_id && session.expires_at > now
  // Never fall back to an old registration after an authenticated session expires.
  const id = active ? session.account_id : !session.account_id ? data.auth_flow.pending_registration_account_id : null
  const account = data.accounts.find(row => row.account_id === id && row.status === 'active')
  if (!account || !data.users.some(user => user.user_id === account.user_id && !user.deleted) || (active && account.user_id !== session.current_user_id)) return null
  const verified = account.local_verification?.method === 'fixed_code' && account.local_verification?.status === 'verified'
  return { account_id: account.account_id, email: account.email, verified, verified_at: verified ? account.local_verification.verified_at : null }
}
