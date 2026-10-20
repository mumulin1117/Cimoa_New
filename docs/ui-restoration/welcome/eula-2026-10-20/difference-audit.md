# Source lock and pre-change audit

User-authorized functional increment, not a claim of matching an absent EULA design.

- AgreementSheet currently places Close after the entire document. Replace with the existing X path in a fixed 44px top-right target; keep the same document content, scroll and safe-area ownership. All shared consumers require regression.
- Welcome checkbox currently owns a transient ref that resets on refresh. Replace it with one Store getter backed by installation consent. Reading policies must remain zero-write.
- Startup currently restores sessions directly. When consent is missing, preserve the session but present Welcome/EULA first; resume the same authenticated destination only after successful consent.
- No first-launch EULA exists. Add a controlled ConfirmDialog with readable content scroll, explicit Not Now / Agree and Continue, no default selection, no service-success claims.
- Existing Terms, Privacy and Guidelines are one canonical source. Do not fork or silently rewrite them. New EULA links to those exact documents. Publication operator/contact and actual moderation remain release blockers.
- Browser and WKWebView evidence, storage failure, decline, refresh, re-open, keyboard, small safe-area viewport and no extra skeleton consumption remain required.

Sources checked: Apple App Review Guidelines 1.2 and 5.1; Apple Standard EULA (license reference only; no claim this draft replaces store licensing requirements).

https://developer.apple.com/app-store/review/guidelines/#user-generated-content

https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
