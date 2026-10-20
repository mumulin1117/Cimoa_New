# Discover swipe source lock and pre-change audit

- Existing deck has only front/back; back is straight and scaled .965 with an 8px downward offset. User now requests staggered corner peeks. Add one rear card with opposite slight rotation; keep original content and controls.
- Current release uses 24% distance OR average speed .75px/ms, so a tiny fast drag can skip. Replace with measured one-third width; use the final release coordinate, not stale last-move state.
- Cards are keyed by user plus front/back role, remounting the incoming photo on every advance. Key by stable user ID and promote the existing back node instead.
- Current mouse listeners are confined to the card; no capture when pointer leaves. Use captured Pointer Events with cancellation and single-pointer checks. Read dimensions only on pointer down, not on every move.
- Current movement triggers reactive style work per event; coalesce through requestAnimationFrame and clear it on hide/unmount. No business writes or loading for a browsing gesture.
- Decorative rear corners need bounded space; reserve 14px within the existing card region rather than overlap CTA/Tabbar. Complete front-card information remains visible on short iPhones.

This increment is authorized by the latest request, not an original prototype pixel match. Prior source screenshots remain historical. No development or interaction convention file changes are needed.
