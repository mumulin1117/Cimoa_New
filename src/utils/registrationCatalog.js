import { terms_document, privacy_document, community_document } from './legalDocuments.js'

// Keep the source Community overview separate from the complete shared documents.
export const community_rules = ['Be respectful.', 'Use your real university identity.', 'Never harass or pressure anyone.', 'Respect boundaries and consent.', 'No illegal or unsafe content.', 'Report anything concerning.']
export const registration_agreements = [
  { ...terms_document, key: 'terms', label: 'I agree to the Terms of Use' },
  { ...privacy_document, key: 'privacy', label: 'I have read the Privacy Policy' },
  { ...community_document, key: 'community', label: 'I agree to follow the Community Guidelines' },
]
