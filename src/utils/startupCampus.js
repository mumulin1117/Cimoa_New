import { prepare_image } from './imagePreparation.js'
export const CAMPUS_PHOTO = '/static/assets/img/welcome-campus.png'

// Shared presentation preparation, never business state or persistent storage.
export function create_campus_preloader({ prepare = prepare_image, schedule = setTimeout, clear = clearTimeout } = {}) {
  let snapshot = { status: 'idle' }, pending = null, preparation = null, timer, generation = 0, armed = false
  const listeners = new Set()
  const publish = status => { snapshot = { status }; listeners.forEach(listener => listener(snapshot)) }
  const cancel = () => { generation++; clear(timer); preparation?.cancel(); preparation = null; pending = null; if (snapshot.status === 'loading') publish('idle') }
  return {
    snapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    arm() { armed = true },
    consume() { const value = armed; armed = false; return value },
    cancel,
    start({ retry = false } = {}) {
      if (pending && !retry) return pending
      if (!retry && snapshot.status === 'ready') return Promise.resolve(snapshot)
      cancel(); const token = generation
      publish('loading'); preparation = prepare(CAMPUS_PHOTO)
      timer = schedule(() => { if (token === generation) { cancel(); publish('error') } }, 10000)
      pending = preparation.ready.then(decoded => {
        if (token === generation) { clear(timer); pending = null; publish(decoded ? 'ready' : 'error') }
        return snapshot
      }, () => { if (token === generation) { clear(timer); preparation?.cancel(); preparation = null; pending = null; publish('error') } return snapshot })
      return pending
    },
  }
}
export const campus_preload = create_campus_preloader()
