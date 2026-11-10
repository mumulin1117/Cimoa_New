import { DISCOVER_DECK } from '../config/discoverDeck.js'

// Presentation only. Eligibility comes from the existing one-shot Tab skeleton;
// neither image readiness nor decorative motion can extend its 600ms lifetime.
export function create_discover_entrance({ change = () => {}, schedule = setTimeout, clear = clearTimeout } = {}) {
  let phase = 'idle', loading = false, eligible = false, person = null, photo = null, timer = null, generation = 0
  const publish = next => { phase = next; change(next) }
  const stop = () => { generation++; clear(timer); timer = null }
  const start = () => {
    if (!eligible || loading || !person || photo !== person) return
    eligible = false
    publish('running')
    const token = generation
    timer = schedule(() => { if (token === generation) { timer = null; publish('complete') } }, DISCOVER_DECK.entrance.sweep_ms)
  }
  const interrupt = () => { stop(); eligible = false; publish('complete') }
  return {
    set_person(id) {
      if (id === person) return
      person = id; photo = null
      if (phase === 'running') interrupt()
    },
    set_loading(value) {
      loading = value
      if (value) { stop(); eligible = true; publish('prepared') }
      else start()
    },
    photo_ready(id) { if (id === person) { photo = id; start() } },
    photo_failed(id) { if (id === person) interrupt() },
    interrupt,
    dispose: interrupt,
  }
}
