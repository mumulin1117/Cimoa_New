const iterations = 210000
const hex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
const decode = value => Uint8Array.from(value.match(/../g), part => Number.parseInt(part, 16))
export const normalize_email = value => String(value || '').trim().toLowerCase()
export const valid_email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize_email(value))
export function age_from_date(value, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const birth = new Date(`${value}T00:00:00Z`), today = new Date(now)
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== value || birth > today) return null
  return today.getUTCFullYear() - birth.getUTCFullYear() - (today.toISOString().slice(5, 10) < value.slice(5) ? 1 : 0)
}
export function signup_error({ email, password, confirmation, date_of_birth, agreements } = {}, now = Date.now()) {
  if (!valid_email(email)) return 'Enter a valid email address.'
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !/\d/.test(password)) return 'Use 8–128 characters with at least one number.'
  if (password !== confirmation) return 'Passwords do not match.'
  const age = age_from_date(date_of_birth, now)
  if (age == null) return 'Enter a valid date of birth.'
  if (age < 18) return 'You must be 18 or older to create an account.'
  if (!['terms', 'privacy', 'community'].every(key => agreements?.[key] === true)) return 'Please confirm all three community agreements.'
  return ''
}
async function derive(password, salt, rounds) {
  if (!globalThis.crypto?.subtle) throw Error('Secure local authentication is unavailable.')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt), iterations: rounds }, key, 256))
}
export async function create_local_credential(password) {
  const credential_salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  return { auth_provider: 'local', credential_algorithm: 'pbkdf2_sha256', credential_iterations: iterations, credential_salt, credential_hash: await derive(password, credential_salt, iterations) }
}
export async function verify_local_credential(account, password) {
  if (account?.auth_provider !== 'local' || account.credential_algorithm !== 'pbkdf2_sha256' || !/^[0-9a-f]{32}$/.test(account.credential_salt) || !/^[0-9a-f]{64}$/.test(account.credential_hash) || account.credential_iterations !== iterations) return false
  return await derive(password, account.credential_salt, account.credential_iterations) === account.credential_hash
}
