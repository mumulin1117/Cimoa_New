# Edit profile source audit — 2026-10-17

Final conflict audit: both the Degree/Major sheet and Basic Info edit the same canonical major. If the parent stages a major then the child saves a newer one, the old parent patch must not overwrite it. Reconcile only fields changed by a canonical save, preserving unrelated unsaved parent text/media. Add overlapping-field browser/native regression; no UI/copy/layout changes.

Source HTML 1057–1227 is locked before changes. Preserve source section order, controls, typography and sheets. Basic info and preferences entries are existing reachability additions, not original elements. Canonical score/status/photos supersede hardcoded demo values.

Found: page owns score business logic; account-ID-only async photo save can publish into a replacement session; replaced/removed draft photo URLs survive unnecessarily; Voice Bio is a dead end despite shared real recording/decoding. Move score to Store, guard full auth context through decoding/publishing, release orphan URLs. Reuse real recording/playback with 30-second limit; final Save alone writes after custom 500ms Loading; cancel/hide releases tracks/URLs, no invented audio success. Preserve text and historical media. Visual acceptance stays pending until actual/source evidence passes.
