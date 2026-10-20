import { terms_document, privacy_document, community_document, eula_document } from './legalDocuments.js'

// A revision change requires fresh, explicit acceptance, not an inferred upgrade.
export const APP_CONSENT_REVISION = [eula_document, terms_document, privacy_document, community_document].map(row => `${row.id}:${row.revision}`).join('|')
export const empty_app_consent = () => ({ revision: null, accepted_at: null })
export const has_app_consent = data => data.app_consent?.revision === APP_CONSENT_REVISION && Number.isFinite(data.app_consent?.accepted_at)
