# Notification permission difference audit

Source: `CIRCA All Screens (interactive).html`, `route=permNotif`, visual lines 3271-3290 and behavior lines 5771-5772.

## Locked source frame

- Source content starts at y=172 with 24px horizontal insets and 16px gaps.
- 92px deep-color bell, 27px title, 17px explanatory copy.
- The denied state adds one white 18px-padded card, `Access is off`, explanatory copy, and a 48px Open Settings action.
- The footer uses 20px horizontal insets, 30px bottom inset, 6px gap, a 60px Allow action and a 46px Don't Allow action.

## Differences found before restoration

- Default state contained an unsourced delivery disclaimer that displaced the locked content.
- The denied/error card contained a second unsourced Back button.
- The prototype writes notification state as granted without waiting for an operating-system result; this is not a valid production behavior.

## Restoration decision

- Remove the unsourced default disclaimer and Back button.
- Retain the source default and denied geometry, with actual platform errors replacing the prototype's generic denied copy only when needed.
- Keep browser and WKWebView capability boundaries explicit: unsupported or failed authorization never writes granted state.
- Preserve delayed Store persistence, rollback, duplicate-tap suppression and lifecycle cancellation.

## Acceptance result

- Browser: 6/6 deterministic checks passed, including Chrome permission grant, unsupported capability, no-host Settings failure, decline, rollback, refresh and compact layout.
- Source comparison: mean absolute channel delta 1.140; inspected differences are font/SVG rasterization edges without geometry displacement.
- iPhone 17 Pro WKWebView on iOS 26.5: 1/1 test passed with the actual native permission-status bridge, 62/34 safe areas and a delayed one-write decline path.
- Default browser and native screenshots were inspected; the unsourced disclaimer and Back button are absent.

Status: verified; source lock and visual acceptance passed.
