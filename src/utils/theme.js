import theme from '@/config/theme.json'

export const theme_style = () => ({
  '--cimoa-page': theme.colors.page.background,
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
