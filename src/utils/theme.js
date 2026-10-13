import theme from '@/config/theme.json'

const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => typeof value === 'object' ? flatten(value, `${prefix}${key}-`) : [[`--cimoa-${prefix}${key.replaceAll('_', '-')}`, value]])
const scale = (value) => String(value).replace(/([\d.]+)rpx/g, (_, number) => `${typeof uni !== 'undefined' ? uni.upx2px(Number(number)) : Number(number) / 2}px`)
export const theme_style = () => ({
  ...Object.fromEntries(flatten(theme.colors)),
  ...Object.fromEntries(flatten(theme.gradients, 'gradient-')),
  ...Object.fromEntries(flatten(theme.shadows, 'shadow-').map(([key, value]) => [key, scale(value)])),
  '--cimoa-page': theme.colors.page.gradient,
  '--cimoa-card': theme.colors.surface.card,
  '--cimoa-deep': theme.colors.surface.deep,
  '--cimoa-border': theme.colors.surface.border,
  '--cimoa-outline': theme.colors.surface.outline,
  '--cimoa-scrim': theme.colors.surface.scrim_soft,
  '--cimoa-lavender': theme.colors.surface.accent_lavender,
  '--cimoa-tinted': theme.colors.surface.tinted,
  '--cimoa-title': theme.colors.text.title,
  '--cimoa-secondary': theme.colors.text.secondary,
  '--cimoa-tertiary': theme.colors.text.tertiary,
  '--cimoa-primary': theme.colors.button.primary,
  '--cimoa-primary-text': theme.colors.button.text,
  '--cimoa-success': theme.colors.status.success,
  '--cimoa-danger': theme.colors.status.danger,
  '--cimoa-info': theme.colors.status.info,
  '--cimoa-coin': theme.colors.status.coin,
  '--cimoa-locked': theme.colors.status.locked,
})

export const apply_theme = () => {
  if (typeof document === 'undefined') return
  Object.entries(theme_style()).forEach(([key, value]) => document.documentElement.style.setProperty(key, value))
}
