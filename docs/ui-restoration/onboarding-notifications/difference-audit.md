# Onboarding Notifications difference audit

Source: `CIRCA All Screens (interactive).html`, `route=obNotif`, visual lines 3180-3192 and behavior lines 5769-5770.

## Locked source frame

- 393 x 852 reference frame with the `cRise` entry animation finished.
- Content starts at source y=176 with 24px horizontal insets and a 16px vertical gap.
- 92px gradient bell, 28px title, 17px explanatory copy.
- Fixed footer has 20px horizontal insets, 30px bottom inset, 6px gap, a 60px primary action and a 46px secondary action.
- Exact copy and interaction IDs are recorded in `source-contract.json`.

## Differences found before restoration

- The Vue page inserted an unsourced delivery disclaimer between the source copy and the footer. It changed the source hierarchy and displaced the visual balance.
- The disclaimer belongs to the dedicated system-permission boundary, where its truthfulness is relevant, not to this pre-permission source frame.
- The prototype marks notifications enabled before the operating-system decision. That behavior cannot be used because it creates false authorization state.

## Restoration decision

- Remove the unsourced disclaimer from this page and keep the source wording, typography, spacing, and fixed footer intact.
- Preserve the real safe-area transform: source y=176 is represented as 132px below the real top inset derived from the source's 44px canvas status region.
- Preserve the Store-only delayed write for Not Now and a no-write transition to the permission page.
- Keep explicit access and persistence errors as approved state-only deltas.

## Acceptance result

- Browser: 6/6 deterministic checks passed at 393 x 852 and 320 x 568.
- Source comparison: mean absolute channel delta 1.036; inspected differences are font/SVG rasterization edges without layout displacement.
- iPhone 17 Pro WKWebView on iOS 26.5: 1/1 test passed, including real 62/34 safe areas, no-write permission navigation, return ownership, failed-write rollback, delayed atomic skip, and duplicate-tap suppression.
- Both success and error screenshots were inspected. No unsourced default-state controls or copy remain.

Status: verified; source lock and visual acceptance passed.
