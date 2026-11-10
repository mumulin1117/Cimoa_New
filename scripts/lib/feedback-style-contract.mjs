// Enforce the existing shared-brand contract, without classifying persistent
// form errors, skeletons, refresh controls or dedicated state pages as Toasts.
const rules = [
  { pattern: /\b(?:uni|wx)\s*(?:\.\s*(?:showToast|hideToast|showLoading|hideLoading)|\[\s*['"](?:showToast|hideToast|showLoading|hideLoading)['"]\s*\])\s*\(/, message: 'Use BrandToastHost/ActionLoading instead of native Toast or Loading APIs.' },
  { pattern: /\bplus\s*\.\s*nativeUI\s*\.\s*(?:toast|showWaiting|closeWaiting)\s*\(/, message: 'Native HUDs must not replace the shared brand feedback.' },
  { pattern: /<(?:uni-toast|uni-load-more|u-toast|u-loading(?:-icon)?)\b/i, message: 'Use the shared branded feedback components instead of default vendor skins.' },
  { pattern: /(?:\.(?:toast|toast-box|toast-container|toast-mask|loading-mask|loading-card|loading__dot|event-loading-ring|chat-action-loading__ring)\s*[{,]|\bclass\s*=\s*['"](?:[^'"]*\s)?(?:toast|toast-box|toast-container|toast-mask|loading-mask|loading-card|loading__dot|event-loading-ring|chat-action-loading__ring)(?:\s[^'"]*)?['"])/, message: 'Legacy Toast/Loading skins must use the shared brand presentation.' },
]

export function feedback_style_violations(source) {
  return rules.filter(rule => rule.pattern.test(source)).map(rule => rule.message)
}
