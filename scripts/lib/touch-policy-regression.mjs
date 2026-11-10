export async function touch_policy_regression() {
  let checks = 0
  const assert = (condition, message) => { checks++; if (!condition) throw Error(message) }
  const before = localStorage.getItem('cimoa_app_state_v2')
  const fixture = document.createElement('div')
  fixture.id = 'touch-policy-acceptance'
  fixture.innerHTML = '<div class="flow-back" role="button" style="width:1px;height:1px"><span>Touch</span></div><p>Ordinary display text</p><img alt="Acceptance image"><input aria-label="Acceptance input"><textarea aria-label="Acceptance textarea"></textarea><div contenteditable="true"><span>Editable text</span><span contenteditable="false">Not editable</span></div>'
  fixture.style.cssText = 'position:fixed;left:0;top:0;z-index:2000;background:var(--cimoa-surface-card);'
  document.body.appendChild(fixture)
  const button = fixture.querySelector('[role=button]'), text = fixture.querySelector('p'), image = fixture.querySelector('img'), input = fixture.querySelector('input'), textarea = fixture.querySelector('textarea'), editor = fixture.querySelector('[contenteditable=true]'), nested = fixture.querySelector('[contenteditable=false]')
  const event = (node, type, properties = {}) => {
    const Constructor = type.startsWith('pointer') || type === 'lostpointercapture' ? PointerEvent : MouseEvent
    const value = new Constructor(type, { bubbles: true, cancelable: true, pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, clientX: 20, clientY: 20, ...properties })
    node.dispatchEvent(value); return value
  }
  const selection = node => {
    const style = getComputedStyle(node)
    return style.getPropertyValue('-webkit-user-select') || style.getPropertyValue('user-select') || style.userSelect
  }
  try {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const rect = button.getBoundingClientRect()
    assert(rect.width >= 43.98 && rect.height >= 43.98, `Minimum target ${rect.width}×${rect.height} below 44`)
    assert(selection(text) === 'none', `Display text can be selected: ${selection(text)}`)
    for (const node of [input, textarea, editor, editor.firstElementChild]) assert(selection(node) === 'text', `Editable selection was disabled: ${node.outerHTML} = ${selection(node)}`)
    assert(selection(nested) === 'none', 'Nested noneditable region selected')
    assert(image.draggable === false, 'Dynamic image remains draggable')
    for (const type of ['contextmenu', 'dragstart', 'selectstart']) {
      assert(event(text, type).defaultPrevented && event(image, type).defaultPrevented, `${type} allowed outside editing`)
      for (const node of [input, textarea, editor.firstElementChild]) assert(!event(node, type).defaultPrevented, `${type} blocked editing`)
    }
    for (const type of ['copy', 'paste', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend']) {
      const value = new Event(type, { bubbles: true, cancelable: true }); input.dispatchEvent(value)
      assert(!value.defaultPrevented, `${type} intercepted`)
    }
    input.value = 'Cimoa campus'; input.focus(); input.setSelectionRange(0, 5)
    assert(document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === 5, 'Input cursor/selection broken')
    textarea.value = 'Meet your campus'; textarea.focus(); textarea.setSelectionRange(5, 9)
    assert(textarea.selectionStart === 5 && textarea.selectionEnd === 9, 'Textarea selection broken')
    let clicks = 0; button.addEventListener('click', () => clicks++)
    event(button, 'pointerdown'); assert(button.dataset.touchState === 'pressed', 'Touch press missing')
    await new Promise(resolve => setTimeout(resolve, 510))
    assert(button.dataset.touchState === 'held' && clicks === 0, 'Hold synthesizes a click or loses state')
    event(button, 'pointerup'); event(button, 'click', { detail: 1 }); assert(clicks === 1 && !button.dataset.touchState, 'Release not exactly one click')
    for (const type of ['pointercancel', 'lostpointercapture']) {
      event(button, 'pointerdown'); event(button, type); event(button, 'click', { detail: 1 })
      assert(clicks === 1 && !button.dataset.touchState, `${type} created a ghost action`)
    }
    event(button, 'pointerdown'); event(button, 'pointerup'); event(button, 'click', { detail: 1 }); assert(clicks === 2, 'Cancel prevents a fresh touch')
    event(button, 'pointerdown'); const move = event(button, 'pointermove', { clientY: 90 })
    assert(!move.defaultPrevented && !button.dataset.touchState, 'Vertical move intercepted/sticks')
    event(button, 'pointercancel')
    button.setAttribute('aria-disabled', 'true'); event(button.firstElementChild, 'click', { detail: 1 })
    assert(clicks === 2, 'Disabled control still acts')
    assert(localStorage.getItem('cimoa_app_state_v2') === before, 'Presentation test mutated business data')
    return { passed: true, checks, target_width: rect.width, target_height: rect.height, editable_selection_retained: true, synthetic_events_do_not_claim_system_clipboard_menu: true }
  } finally { fixture.remove() }
}
