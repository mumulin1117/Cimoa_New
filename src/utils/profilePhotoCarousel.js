// UI-only cadence. Restart rather than catching up after a hidden page or sheet.
export function create_profile_photo_carousel({ advance, can_advance, schedule = setTimeout, cancel = clearTimeout }) {
  let timer = null
  const stop = () => { if (timer !== null) cancel(timer); timer = null }
  const restart = () => {
    stop()
    if (!can_advance()) return
    timer = schedule(() => {
      timer = null
      if (!can_advance()) return
      advance()
      restart()
    }, 3000)
  }
  return { restart, stop }
}
