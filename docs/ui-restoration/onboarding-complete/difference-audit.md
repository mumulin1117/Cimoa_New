# Onboarding Complete difference audit

Source: `CIRCA All Screens (interactive).html`, `route=obComplete`, visual lines 3195-3206 and behavior line 5590.

## Locked source frame

- Content begins at y=196 with 24px horizontal insets and 16px gaps.
- 96px gradient check, 31px title and centered 17px copy with a 290px maximum width.
- Fixed footer uses 20px horizontal insets, a 34px bottom inset and one 60px primary action.

## Differences found before restoration

- The failure state added two unsourced recovery links below the error. They changed the locked hierarchy and introduced interactions absent from the source.
- The source button says `Explore CIRCA`; the product has been renamed and configured as `Cimoa`.
- The prototype marks a new user and opens Home without validating profile entities or media ownership.

## Restoration decision

- Remove the unsourced recovery links. Keep explicit state errors and the source action for retry.
- Use `Explore Cimoa` as the approved brand substitution.
- Require the Store to validate all onboarding fields and owned IndexedDB photo blobs before one delayed atomic completion transaction.
- Prepare the one-time main Tab skeleton and reLaunch Home only after persistence succeeds.

## Acceptance result

- Browser source-frame suite: 4/4 passed at 393 x 852 and 320 x 568; mean absolute channel delta 1.241.
- Browser full registration suite: 18/18 passed from Splash through owned IndexedDB photos, Store completion, Home, three one-time Tab skeletons, Profile synchronization, refresh and re-login.
- iPhone 17 Pro WKWebView source-frame test: 1/1 passed with 62/34 safe areas and exact source geometry.
- iPhone 17 Pro WKWebView full registration test: 1/1 passed through real photo blobs, Home/Tab/Profile synchronization, refresh, profile editing and re-login; test cleanup restored the exact prior app and IndexedDB state.
- Default browser and native screenshots were inspected; no unsourced recovery links remain.

Status: verified; source lock and visual acceptance passed.
