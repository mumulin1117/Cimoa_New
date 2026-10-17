# Blocked accounts audit — 2026-10-17

HTML 3893–3933 is authoritative: populated/empty lists and Unblock confirmation. Existing 52px portraits, 14px padding and 40px button are reused. Real unblock removes only the block, never resurrects consent/messages. Found missing full-session guard on delayed unblock. Add synchronous scope cancellation and clear selected target when invalid. Preserve failure/cancel, write only after custom 500ms Loading. Cross-surface block filtering/refresh must regress; visual acceptance stays pending.
