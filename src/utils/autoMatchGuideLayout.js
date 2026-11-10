const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, Math.max(minimum, maximum)))

export const AUTO_MATCH_GUIDE_TARGETS = Object.freeze(['.home-match', '.am-1505-49', '.am-1504-45', ''])

// Pure viewport geometry. Values entering/leaving this function are measured
// logical points; only the component converts them to the project's rpx units.
export const auto_match_guide_layout = ({ width, height, safe_top = 0, safe_bottom = 0, anchor = null, card_height = 0, chrome_height = 0, interactive_target = false } = {}) => {
  const w = Math.max(1, finite(width, 393)), h = Math.max(1, finite(height, 852)), scale = w / 393
  const edge = 20 * scale, gap = 16 * scale
  const top = clamp(finite(safe_top), 0, h) + 12 * scale
  const bottom = Math.max(top + 1, h - clamp(finite(safe_bottom), 0, h) - 16 * scale)
  const available = Math.max(1, bottom - top), card_width = Math.max(1, w - edge * 2)
  const chrome = Math.max(0, finite(chrome_height)), wanted = Math.max(chrome + 1, finite(card_height, 360 * scale))
  let spot = null
  if (anchor && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(Number(anchor[key]))) && anchor.width > 0 && anchor.height > 0) {
    const pad = 6 * scale
    const left = clamp(anchor.left - pad, 6 * scale, w - 6 * scale)
    const right = clamp(anchor.left + anchor.width + pad, left, w - 6 * scale)
    const spot_top = clamp(anchor.top - pad, finite(safe_top), bottom)
    const spot_bottom = clamp(anchor.top + anchor.height + pad, spot_top, bottom)
    if (right > left && spot_bottom > spot_top && anchor.top < bottom && anchor.top + anchor.height > finite(safe_top)) {
      spot = { left, top: spot_top, width: right - left, height: spot_bottom - spot_top, right, bottom: spot_bottom }
    }
  }
  let card_top, card_size, placement = 'center'
  if (spot) {
    const above = Math.max(0, spot.top - gap - top), below = Math.max(0, bottom - spot.bottom - gap)
    placement = below >= wanted || below >= above ? 'below' : 'above'
    const room = placement === 'below' ? below : above
    // Reserve all controls before shrinking only the scrollable explanation.
    // If an unusual viewport leaves neither side usable, retain a safe centered
    // card rather than allowing controls to escape the physical safe areas.
    // Interactive lessons cannot discard their only operable target while Next
    // waits for a real selection. Their compact card keeps all 44pt controls
    // and lets only the explanation scroll within the measured remaining room.
    const minimum_body = interactive_target ? 24 * scale : 58 * scale
    if (room >= Math.min(wanted, chrome + minimum_body)) {
      card_size = Math.min(wanted, room)
      card_top = placement === 'below' ? spot.bottom + gap : spot.top - gap - card_size
    } else {
      spot = null; placement = 'center'
    }
  }
  if (!spot) { card_size = Math.min(wanted, available); card_top = top + (available - card_size) / 2 }
  card_top = clamp(card_top, top, bottom - card_size)
  const mask = spot ? [
    { left: 0, top: 0, width: w, height: spot.top },
    { left: 0, top: spot.top, width: spot.left, height: spot.height },
    { left: spot.right, top: spot.top, width: w - spot.right, height: spot.height },
    { left: 0, top: spot.bottom, width: w, height: Math.max(0, h - spot.bottom) },
  ] : [{ left: 0, top: 0, width: w, height: h }]
  return {
    viewport: { width: w, height: h },
    card: { left: edge, top: card_top, width: card_width, height: card_size },
    body_height: Math.max(1, card_size - chrome),
    spot,
    mask,
    placement,
    rpx_scale: 750 / w,
  }
}

// An even-odd path keeps the actual circular/pill-shaped target bright without
// exposing the square corners of the geometry retained above for hit tests.
export const auto_match_guide_scrim_path = layout => {
  const { width = 0, height = 0 } = layout?.viewport || {}
  if (!(width > 0 && height > 0)) return ''
  const outer = `M0 0H${width}V${height}H0Z`, spot = layout.spot
  if (!spot) return outer
  const { left, top, right, bottom } = spot
  const radius = Math.min(64.885 / layout.rpx_scale, spot.width / 2, spot.height / 2)
  return `${outer}M${left + radius} ${top}H${right - radius}A${radius} ${radius} 0 0 1 ${right} ${top + radius}V${bottom - radius}A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}H${left + radius}A${radius} ${radius} 0 0 1 ${left} ${bottom - radius}V${top + radius}A${radius} ${radius} 0 0 1 ${left + radius} ${top}Z`
}
