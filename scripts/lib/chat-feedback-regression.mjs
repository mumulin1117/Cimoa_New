export async function chat_feedback_regression({ recovery = false } = {}) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms)), checks = []
  const visible = selector => [...document.querySelectorAll(selector)].find(element => element.getBoundingClientRect().height > 0)
  const wait = async predicate => { for (let i = 0; i < 250; i++) { if (predicate()) return; await delay(25) } throw Error('Chat feedback timeout at ' + location.hash) }
  const assert = (condition, message) => { if (!condition) throw Error(message) }
  const bytes = () => localStorage.getItem('cimoa_app_state_v2'), data = () => JSON.parse(bytes()).data
  const click = id => { const element = visible(`[data-interaction="${id}"]`); assert(element, 'Missing ' + id); element.click() }
  const input = () => visible('uni-input[aria-label="Message"] input')
  const type = text => { const element = input(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, text); element.dispatchEvent(new Event('input', { bubbles: true })) }
  const sent = body => data().messages.filter(message => message.conversation_id === 'conversation_chloe' && message.body === body)
  const idle = () => wait(() => !visible('.chat-action-loading'))
  if (recovery) {
    await wait(() => input()); await idle()
    assert(sent('A quieter conversation.').length === 1 && sent('Keep my answer for retry.').length === 1, 'Text did not restore exactly once')
    await wait(() => visible('.chat-image .profile-photo')?.dataset.mediaStatus === 'ready')
    assert(data().messages.filter(message => message.conversation_id === 'conversation_chloe' && message.kind === 'image').length === 1, 'Photo not restored exactly once')
    assert(!visible('.event-loading') && !document.body.innerText.includes('Saving message'), 'Redundant save feedback after recovery')
    await document.fonts.ready
    for (const animation of document.getAnimations()) if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return { checks: ['Fresh document restores both messages and the IndexedDB photo exactly once without a Saving message prompt'] }
  }
  const initial = bytes(), original = Storage.prototype.setItem
  let forbidden_overlay = false
  const observer = new MutationObserver(() => { if (visible('.direct-chat-page') && visible('.event-loading')) forbidden_overlay = true })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true })
  try {
    click('home.openMaya.click.1'); await wait(() => input()); await delay(20)
    assert(visible('.chat-read-progress'), 'Read receipt has no inline Loading')
    assert(!input().disabled && !visible('.event-loading'), 'Read receipt blocked the composer or whole page')
    type('Typing while read status updates.'); await delay(20)
    assert(bytes() === initial, 'Read receipt wrote before its Loading delay')
    click('chat.goBack.click.1'); await wait(() => visible('.home-header')); await delay(650)
    assert(bytes() === initial, 'Leaving during read Loading persisted a stale receipt')
    checks.push('Entry uses non-blocking inline read status; typing is enabled and early Back cancels the delayed write')
    click('home.openMaya.click.1'); await wait(() => input()); await idle()
    assert(data().messages.filter(message => message.conversation_id === 'conversation_chloe').every(message => message.read_by.includes('user_cimoa')), 'Read receipt did not persist')
    checks.push('Read status persists through the Store after its Loading, without a full-screen save prompt')
    type('A quieter conversation.'); await delay(30)
    const before_send = bytes(); click('chat.send.click.1'); await delay(30)
    assert(visible('.chat-send .chat-action-loading') && visible('.chat-send').getAttribute('aria-busy') === 'true', 'No send-button request state')
    assert(!visible('.event-loading') && bytes() === before_send, 'Send blocked the whole page or wrote before Loading')
    assert(getComputedStyle(visible('.secondary-page-scroll .uni-scroll-view')).overflowY !== 'hidden', 'Sending disabled message scrolling')
    click('chat.send.click.1'); await delay(120); assert(bytes() === before_send, 'Message persisted before its Loading delay')
    await wait(() => sent('A quieter conversation.').length > 0); await idle(); await wait(() => input().value === '')
    assert(sent('A quieter conversation.').length === 1 && input().value === '', 'Send duplicated or failed to clear its draft')
    checks.push('Send-button spinner precedes one write, repeated send is ignored and history remains scrollable')
    type('Keep my answer for retry.'); await delay(30); const before_failure = bytes()
    Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') throw Error('Storage full'); return original.call(this, key, value) }
    click('chat.send.click.1'); await delay(30); assert(visible('.chat-send .chat-action-loading'), 'Failure path skipped Loading')
    await wait(() => document.querySelector('.brand-toast--error')?.textContent.includes('Your device doesn’t have enough space. Free up some space and try again.')); await idle()
    assert(bytes() === before_failure && input().value === 'Keep my answer for retry.' && !sent('Keep my answer for retry.').length, 'Failure lost draft or persisted a partial message')
    Storage.prototype.setItem = original; click('chat.send.click.1'); await wait(() => sent('Keep my answer for retry.').length > 0); await idle(); await wait(() => input().value === '')
    assert(sent('Keep my answer for retry.').length === 1 && input().value === '', 'Retry duplicated a message')
    checks.push('Storage failure leaves data and draft intact; retry succeeds once and clears the error')
    const before_call = bytes(); click('chat.startCall.click.1'); await delay(30)
    assert(visible('.chat-call .chat-action-loading') && !visible('.event-loading') && bytes() === before_call, 'Call uses a save prompt or writes early')
    click('chat.startCall.click.1'); await wait(() => visible('.waiting-call-page'))
    assert(data().call_sessions.length === 1 && !document.querySelector('video'), 'Duplicate or fake connected call')
    click('callActive.endCall.click.1'); await wait(() => input()); await idle()
    assert(location.hash.includes('conversation_chloe') && data().call_sessions[0].ended_at, 'Call did not return to its conversation')
    checks.push('Call-button spinner creates one waiting-only session and hangup returns to the same chat')
    const before_photo = bytes(), suppress = event => { if (event.target.matches('input[type=file]')) event.preventDefault() }
    document.addEventListener('click', suppress, true)
    try {
      click('chat.sendPhoto.click.1'); await wait(() => document.querySelector('input[type=file]'))
      const transfer = new DataTransfer(), blob = await (await fetch('/static/assets/head/maya-full.png')).blob()
      transfer.items.add(new File([blob], 'campus-photo.png', { type: blob.type }))
      const field = [...document.querySelectorAll('input[type=file]')].at(-1); field.files = transfer.files; field.dispatchEvent(new Event('change', { bubbles: true }))
    } finally { document.removeEventListener('click', suppress, true) }
    await wait(() => visible('.chat-media-preview .profile-photo')?.dataset.mediaStatus === 'ready')
    assert(bytes() === before_photo, 'Photo preview wrote business data')
    click('chat.media.send.click.1'); await delay(30)
    assert(visible('.chat-media-send .chat-action-loading') && !visible('.event-loading') && bytes() === before_photo, 'Media confirmation has no inline request state or wrote early')
    click('chat.media.send.click.1'); await wait(() => data().messages.some(message => message.conversation_id === 'conversation_chloe' && message.kind === 'image')); await idle()
    await wait(() => visible('.chat-image .profile-photo')?.dataset.mediaStatus === 'ready')
    const images = data().messages.filter(message => message.conversation_id === 'conversation_chloe' && message.kind === 'image')
    assert(images.length === 1 && data().media_files.some(media => media.media_id === images[0].media_id), 'Media message duplicated or lost its metadata')
    checks.push('Photo preview remains unpublished; confirmation shows an in-button spinner and atomically saves one real image')
    click('chat.goBack.click.1'); await wait(() => visible('.home-header')); click('home.openMaya.click.1'); await wait(() => input()); await idle()
    type('Cancelled before send.'); await delay(30); const before_cancel = bytes()
    click('chat.send.click.1'); await delay(30); history.back(); await wait(() => visible('.home-header')); await delay(650)
    assert(bytes() === before_cancel && !sent('Cancelled before send.').length, 'Hidden send timer wrote a message')
    click('home.openMaya.click.1'); await wait(() => input()); await idle()
    assert(!forbidden_overlay && !document.body.innerText.includes('Saving message'), 'Normal chat displayed a save overlay')
    checks.push('History Back cancels a pending send; re-entry is usable and normal read/send/call paths never show a save overlay')
    return { checks, forbidden_overlay, media_ids: images.map(message => message.media_id) }
  } finally { Storage.prototype.setItem = original; observer.disconnect() }
}
