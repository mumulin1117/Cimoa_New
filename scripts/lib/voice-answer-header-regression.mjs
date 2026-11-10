// Shared browser/WKWebView driver; it never requests the microphone or sends an introduction.
export async function voice_answer_header_regression({ mode = 'flow' } = {}) {
  const checks = [], check = (value, label) => { if (!value) throw Error(label); checks.push(label) }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const pages = [...document.querySelectorAll('uni-page')], rect = element.getBoundingClientRect()
    return (element.closest('#cimoa-toast-root') || element.closest('uni-page') === pages.at(-1)) && rect.width > 0 && rect.height > 0
  })
  const wait = async (selector, absent = false) => { for (let attempt = 0; attempt < 320; attempt++) { const found = current(selector); if (absent ? !found : found) return found; await delay(25) } throw Error(`Waiting for ${selector} on ${location.hash}`) }
  const settled = async selector => {
    const root = await wait(selector); await document.fonts.ready
    await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return root
  }
  const tap = id => current(`[data-interaction="${id}"]`).click()
  const bytes = () => localStorage.getItem('cimoa_app_state_v2'), before = bytes()
  if (mode === 'flow') {
    const select = await settled('.ice-select-page'), question = select.querySelectorAll('.ice-choice')[1]
    const question_text = question.textContent.trim(), depth = Number(select.dataset.pageDepth)
    question.click(); tap('ibSelect.pickVoice.click.1'); tap('ibSelect.answerGo.click.1')
    let voice = await settled('.ice-voice-page')
    check(voice.querySelector('.ice-question-text').textContent.trim() === question_text, 'Voice entry retains the selected canonical question')
    check(voice.querySelector('[data-interaction="ibVoice.sendVoiceRequest.click.1"]').getAttribute('aria-disabled') === 'true', 'Review stays disabled without a playable recording')
    tap('ibVoice.record.click.1'); await wait('[data-interaction="sheetMic.denyMic.click.1"]')
    tap('sheetMic.denyMic.click.1'); await wait('.event-dialog', true)
    check(!!current('[aria-label="Start recording"]'), 'Microphone pre-prompt can be cancelled without requesting a microphone or creating audio')
    tap('ibVoice.switchToTextReply.click.1'); const text = await settled('.ice-text-page')
    check(text.querySelector('.ice-header-title').textContent.trim() === 'Your answer', 'Text and voice use the same Your answer title')
    tap('ibText.switchToVoice.click.1'); voice = await settled('.ice-voice-page')
    check(voice.querySelector('.ice-question-text').textContent.trim() === question_text, 'Text/voice round trip retains the question')
    tap('ibVoice.goBack.click.1'); await settled('.ice-select-page')
    check(current('.ice-select-page') === select && Number(select.dataset.pageDepth) === depth, 'Back returns to the actual question-selection instance')
    check(select.querySelector('.ice-choice--selected').textContent.trim() === question_text, 'Back preserves the selected question')
    tap('ibSelect.answerGo.click.1'); await settled('.ice-voice-page')
  }
  const root = await settled('.ice-voice-page'), header = root.querySelector('.ice-header'), title = header.querySelector('.ice-header-title')
  const title_rect = title.getBoundingClientRect(), page_rect = root.getBoundingClientRect(), back_rect = header.querySelector('.ice-back').getBoundingClientRect()
  check(title.textContent.trim() === 'Your answer', 'Voice answer title is exactly Your answer')
  check(!header.querySelector('.ice-menu,[data-interaction="ibVoice.openVoiceMenu.click.1"],[aria-label="Voice options"]'), 'There is no More button, menu hotspot or Voice options accessibility entry')
  check(header.querySelectorAll('[role="button"]').length === 1 && !!header.querySelector('[data-interaction="ibVoice.goBack.click.1"]'), 'Back is the only header control')
  check(Math.abs(title_rect.x + title_rect.width / 2 - page_rect.x - page_rect.width / 2) < 1, 'Title remains centered after removing More')
  check(back_rect.x >= page_rect.x && back_rect.right <= page_rect.right && back_rect.y >= 0, 'Back remains within the safe viewport')
  check(!root.querySelector('.ice-unavailable') && bytes() === before, 'Header and navigation checks do not write drafts, requests or coins')
  return { passed: true, mode, checks, title: title.textContent.trim(), width: page_rect.width, route: location.hash, actual_microphone_requested: false }
}
