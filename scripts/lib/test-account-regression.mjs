// Shared real-UI regression for isolated browsers and nonPersistent WKWebViews.
export async function test_account_regression({ mode = 'login' } = {}) {
  const checks = [], key = 'cimoa_app_state_v2', email = 'cimoa@connect.edu', old_email = 'cimoa@gmail.com'
  const check = (value, message) => { if (!value) throw Error(message); checks.push(message) }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const wait = async (predicate, message) => { for (let index = 0; index < 500; index++) { const result = predicate(); if (result) return result; await delay(16) } throw Error(message) }
  const visible = selector => [...document.querySelectorAll(selector)].find(element => element.getBoundingClientRect().height > 0 && (!element.closest('uni-page') || element.closest('uni-page') === [...document.querySelectorAll('uni-page')].at(-1)))
  const raw = () => localStorage.getItem(key), before = raw(), previous = JSON.parse(before).data
  const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app')
  const original_write = Storage.prototype.setItem
  let attempts = 0, writes = 0, fail_write = mode === 'write-failure'
  Storage.prototype.setItem = function (name, value) {
    if (name === key) { attempts++; if (fail_write) throw Error('Diagnostic storage failure') }
    const result = original_write.call(this, name, value)
    if (name === key) writes++
    return result
  }
  try {
    if (mode === 'conflict') {
      await wait(() => visible('.splash-error'), 'Conflicting account did not retain startup Retry')
      check(store.hydration_status === 'error' && raw() === before && writes === 0, 'A destination-email conflict does not overwrite either account or storage')
      check(!visible('.home-header,.discover-deck,.events-header'), 'Conflicted storage cannot expose any protected main module')
      return { passed: true, mode, checks, attempts, writes }
    }
    const expected = structuredClone(previous), account = expected.accounts.find(row => row.account_id === 'account_cimoa')
    account.email = email
    if (expected.auth_flow.email === old_email) expected.auth_flow.email = email
    check(store.hydration_status === 'ready', 'Existing account data hydrates successfully')
    check(JSON.stringify(store.data) === JSON.stringify(expected), 'Hydration changes only the canonical account email and its own entry context')
    check(raw() === before && writes === 0, 'Read-only migration adds no startup write or artificial Loading')
    check(store.data.accounts.filter(row => row.account_id === 'account_cimoa' && row.user_id === 'user_cimoa').length === 1, 'The original account and user identity are not duplicated or replaced')
    if (mode === 'session') {
      await wait(() => visible('.home-header'), 'Valid legacy session did not restore Home')
      check(location.hash.endsWith('/pages/home/index'), 'Valid account recovery uses the Home default route')
      check(store.current_user.email === email, 'An existing signed-in account immediately reads the new canonical email')
      check(JSON.stringify(store.data.session) === JSON.stringify(previous.session), 'Session recovery retains its original identity and expiration')
      check(raw() === before && writes === 0, 'Restoring the existing session does not rewrite the old data prematurely')
      return { passed: true, mode, checks, attempts, writes }
    }
    const page = await wait(() => visible('.login-page'), 'The real Login page is unavailable')
    await wait(() => +getComputedStyle(page.querySelector('.page-transition')).opacity > .99, 'Login did not finish its original entry animation')
    const fields = [...page.querySelectorAll('input')]
    const fill = (index, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(fields[index], value); fields[index].dispatchEvent(new Event('input', { bubbles: true })) }
    check(fields[0].value === email, 'The legacy login prefill is normalized to the new address')
    const submit = page.querySelector('[data-interaction="login.loginNow.click.1"]')
    const attempt = async (address, password, succeeds) => {
      fill(0, address); fill(1, password); await delay(30); submit.click(); submit.click()
      await wait(() => visible('.brand-action-loading'), 'Login did not retain the shared brand progress feedback')
      check(raw() === before && writes === 0, 'Login feedback appears before the account/session write')
      if (!succeeds) {
        await wait(() => !visible('.brand-action-loading') && visible('.login-page [role="alert"]'), 'Failed login did not retain a real error')
        check(raw() === before && writes === 0 && !store.session.is_authenticated, 'Failed login cannot change data, create a session or lose the migrated identity')
      }
    }
    await attempt(old_email, '12341234', false)
    check(attempts === 0, 'The former address is not a second login alias')
    if (mode === 'write-failure') {
      await attempt(email, '12341234', false)
      check(attempts === 1 && store.data.accounts[0].email === email, 'A failed first persistence leaves the in-memory identity intact and disk recoverable')
      fail_write = false
    } else await attempt(email, 'wrong-password', false)
    await attempt(' Cimoa@Connect.edu ', '12341234', true)
    await wait(() => visible('.home-header'), 'Successful canonical login did not enter Home')
    check(location.hash.endsWith('/pages/home/index'), 'Successful canonical login clears the authentication stack into Home')
    const saved = JSON.parse(raw()).data
    check(writes === 1 && saved.accounts.find(row => row.account_id === account.account_id).email === email, 'The first successful action persists the renamed identity once despite duplicate activation')
    check(JSON.stringify(saved.accounts) === JSON.stringify(expected.accounts), 'All account IDs, password credentials and statuses remain unchanged')
    for (const table of Object.keys(expected).filter(name => !['accounts', 'auth_flow', 'session', 'revision', 'updated_at'].includes(name))) check(JSON.stringify(saved[table]) === JSON.stringify(expected[table]), `Existing ${table} survive the account migration unchanged`)
    check(saved.session.account_id === account.account_id && saved.session.current_user_id === account.user_id, 'New-address login resumes the same user, not a new account')
    check(!/009789|Show code again/.test(document.body.innerText), 'The internal verification code is not exposed by login or entry UI')
    return { passed: true, mode, checks, attempts, writes, persisted_email: email }
  } finally { Storage.prototype.setItem = original_write }
}
