// One content source for Welcome, registration sheets, Settings and Coin Help.
// Presentation must not supply a different summary, notice or publication claim.
const document = value => Object.freeze({ ...value, sections: Object.freeze(value.sections.map(section => Object.freeze(section))) })

export const eula_document = document({
  id: 'eula',
  revision: '2026-10-20',
  title: 'End User License Agreement',
  updated: 'Effective 20 October 2026',
  intro: 'Welcome to Cimoa. Start with a better question, find your people and make thoughtful campus connections. Please read this agreement before continuing. By choosing Agree and Continue, you accept this agreement and the Terms of Use, acknowledge the Privacy Policy and agree to follow the Community Guidelines.',
  sections: [
    ['1. Who Cimoa is for', 'Cimoa is for university students aged 18 or older. Provide accurate age, university and profile information. Do not impersonate another person, share an account or misrepresent your eligibility. A profile, suggestion or connection is not a guarantee of someone’s identity.'],
    ['2. Your permission to use Cimoa', 'You may use Cimoa for your own personal, lawful campus social activity on devices you own or control, subject to this agreement and any applicable App Store usage rules. Do not resell access, copy protected app materials, interfere with security or use automated tools to harvest profiles or contact people in bulk. Your statutory rights and applicable open-source licenses remain unaffected.'],
    ['3. Your profile and content', 'You remain responsible for the photos, text, voice introductions, messages and event content you choose to share. Share only material you own or have permission to use. Permit Cimoa to display and handle that content only as needed for the features you choose, your visibility settings and the practices described in the Privacy Policy. Do not expose someone else’s private information or copy their voice or identity without permission.'],
    ['4. Zero tolerance for abuse', 'Objectionable content and abusive behavior are not permitted. Do not share pornography, non-consensual intimate imagery, child sexual abuse material, threats, hate speech or content promoting violence or illegal activity. Harassment, bullying, stalking, grooming, exploitation, scams and spam are prohibited across profiles, introductions, messages and event groups. Never use another account to evade a block or rejection.'],
    ['5. Connections and consent', 'A card view, match suggestion, event membership or coin spend does not mean someone has agreed to contact. Respect mutual connection choices, boundaries and refusals. Do not pressure anyone to reply, share media, join a call or meet in person. Use the Report and Block controls for concerning content or unwanted contact; the result shown after an action describes what was completed. Do not rely on a report for emergency assistance.'],
    ['6. Campus events and personal safety', 'Check event details, organizers, locations and costs before making plans. Meet in public, tell someone you trust and leave if you feel unsafe. Participation is your choice, and joining a group does not authorize private contact. Cimoa is not an emergency service; contact campus security or local emergency services if someone is in immediate danger.'],
    ['7. Optional purchases and availability', 'Core campus social features are free. Where offered, optional coin features show their cost before confirmation. Coins have no cash value and do not guarantee a connection, response or compatibility. A failed, cancelled or unavailable purchase does not add coins. Only a confirmed transaction changes the balance. Features that need a permission, resource or service may be unavailable; do not treat a waiting screen as an established call.'],
    ['8. Privacy and your choices', 'Read the Privacy Policy for the information handled by Cimoa and how it is stored. You can manage visibility and permissions, block unwanted contacts and delete your account in Settings. Accepting this agreement does not grant camera, microphone, photo or notification permission; each is requested separately when needed.'],
    ['9. Ending use and applicable terms', 'You may stop using Cimoa at any time. Do not continue using features in a way that violates these rules. Account deletion and blocking have the effects described in the Terms of Use and Privacy Policy. This agreement does not waive mandatory consumer rights, promise uninterrupted availability or replace applicable App Store licensing terms. The linked documents explain current service availability and contact information.'],
  ],
  footer: 'Read the Terms of Use, Privacy Policy and Community Guidelines below. If you do not agree, choose Not Now; you can review this agreement again before continuing.',
})

export const terms_document = document({
  id: 'terms',
  revision: '2026-10-14',
  title: 'Terms of Use',
  updated: 'Local draft · 14 October 2026',
  intro: 'These terms describe the behavior of this local Cimoa build. They are not published production terms and do not identify a configured operator, legal entity or support contact.',
  sections: [
    ['1. Local build and eligibility', 'Cimoa is designed for university students aged 18 or older. This build stores accounts locally and does not independently confirm that an email address or student status is genuine.'],
    ['2. Your local account', 'Keep the password for your on-device account private. Registration, login and password reset operate only against account data stored on this device. Apple sign-in is not configured.'],
    ['3. Community conduct', 'Be respectful. Do not harass, threaten, impersonate, pressure or exploit another person, and do not share illegal or unsafe content. Local reports are personal records and are not delivered to a moderation team.'],
    ['4. Local data and unavailable services', 'Profiles, messages, event activity, settings and safety records are stored on this device. Remote messaging, matching, email verification, support delivery and moderation services are not configured unless a screen explicitly reports a real available capability.'],
    ['5. Coins and purchases', 'Coins are local ledger entries with no cash value. StoreKit products, payment processing and receipt verification are not configured, so a purchase attempt cannot add coins and must report failure, cancellation or timeout.'],
    ['6. Events and personal safety', 'Event details come from local project data. Cimoa does not provide a live organiser, emergency or attendance service in this build. Use appropriate campus or emergency channels when real-world help is needed.'],
    ['7. Blocking and account deletion', 'Blocking removes the current private connection, request, match and chat data; unblocking does not restore them. Deleting an account removes its private local records and cannot be undone through this build.'],
    ['8. Publication status', 'A production operator, jurisdiction, dispute process, legal contact and release terms have not been supplied. This local draft is for development and testing and must not be treated as approval for public release.'],
  ],
  footer: 'No production legal or support contact is configured for this local build.',
})

export const privacy_document = document({
  id: 'privacy',
  revision: '2026-10-14',
  title: 'Privacy Policy',
  updated: 'Local draft · 14 October 2026',
  intro: 'This notice describes information handled by this local Cimoa build. It is not a published production privacy policy and does not identify a configured controller, processor or privacy contact.',
  sections: [
    ['1. Information stored locally', 'The app may store your email, salted password credential, date of birth, profile fields, preferences, local verification state, messages, event activity, safety records, coin ledger and support drafts on this device.'],
    ['2. Photos, audio and other media', 'Media you choose is stored in the browser or app’s local media database. This build does not upload that media to a Cimoa server. A missing or denied device capability is reported as unavailable.'],
    ['3. Profile visibility', 'Your visibility settings control which local profile fields appear in Discover, Auto Match and event surfaces. Your email and date of birth are not shown on public profile cards. Existing chats may remain visible when discovery is hidden.'],
    ['4. Messages and connections', 'Private chats are available only for a mutual local connection. Blocking removes the current private relationship, request, match, conversation and its messages. Unblocking does not recreate deleted records.'],
    ['5. Reports and support drafts', 'Reports and support notes are saved only on this device. They are not sent to a moderation or support service, and no review status, decision or ticket is created.'],
    ['6. Authentication and permissions', 'Email registration and password reset are local. The fixed code does not prove control of an email address or student status. Apple sign-in is not configured. System permission status comes from the browser or iOS host and cannot be changed by Cimoa itself.'],
    ['7. Purchases and external services', 'StoreKit products, payment receipt verification, remote matching, push delivery and production service providers are not configured. The app does not claim data sharing with providers that have not been supplied.'],
    ['8. Retention, clearing and deletion', 'Local records remain until changed, deleted through the app or removed with site/app data. Account deletion removes that account’s private local entities and media where the local media database permits. Clearing app data can remove all local accounts.'],
    ['9. Production gaps', 'A production operator, legal basis, jurisdiction, retention schedule, data-rights process and privacy contact have not been provided. Those items must be completed before public release.'],
  ],
  footer: 'No production privacy or support contact is configured for this local build.',
})

export const community_document = document({
  id: 'community',
  revision: '2026-10-19',
  title: 'Community Guidelines',
  updated: 'Community rules · 19 October 2026',
  intro: 'Cimoa is for thoughtful campus connections, not unwanted attention. These rules apply to profiles, photos, audio, icebreakers, Discover, Auto Match, connection requests, private chats and event groups. We have zero tolerance for objectionable content or abusive behavior. The final section explains the safety-service limits of this build.',
  sections: [
    ['1. Adults and authentic campus identities', 'You must be at least 18 and a university student to use Cimoa. Give accurate age and university information, use photos you have permission to use, and do not impersonate another person or institution. Do not create accounts for minors or evade an age restriction. This build’s fixed verification code is not proof of email ownership or student status.'],
    ['2. Respect, boundaries and consent', 'No harassment, stalking, bullying, threats, hate speech or discrimination. Never pressure someone for a reply, a relationship, sexual attention, a call or an offline meeting. A match, event membership, gift or coin spend is not consent. Respect rejection, silence and blocking; do not use another account or group to continue unwanted contact.'],
    ['3. Sexual content and child safety', 'Do not post or send pornography, sexually explicit material, sexual solicitation or non-consensual intimate images, including manipulated or AI-generated images. Child sexual abuse or exploitation, grooming, sexual content involving anyone under 18, sextortion and human trafficking are strictly prohibited. Do not save or redistribute suspected child-abuse material; use appropriate authorities for urgent safety concerns.'],
    ['4. Violence, exploitation and illegal activity', 'Do not threaten or encourage violence, terrorism, self-harm, dangerous challenges or exploitation. Do not promote illegal goods, drugs, weapons, prostitution or unsafe conduct. Do not use profiles, messages or events to recruit people into harmful or illegal activities. Cimoa is not an emergency service; contact campus security or local emergency services if someone may be in immediate danger.'],
    ['5. Privacy, media and ownership', 'Share only content you own or have permission to share. Do not expose another person’s private messages, identity documents, contact details, home or dorm address, or precise whereabouts without consent. Do not impersonate someone through photos or a cloned voice. Do not record, screenshot or redistribute intimate or private material without permission. Keep passwords and verification details private.'],
    ['6. Introductions, Discover and Auto Match', 'Use icebreaker questions to start respectful, relevant conversations. Browsing a card or receiving a match suggestion does not establish a connection. Private chats require a mutual connection; do not bypass that choice or send repeated requests. Cimoa is not for anonymous chat roulette, rating people’s attractiveness or treating people as objects. A suggestion is not an endorsement or a guarantee of compatibility or identity.'],
    ['7. Messages, voice and calls', 'The same rules apply to text, photos, voice introductions, private messages and group messages. Do not send unwanted sexual or abusive media, spam, malicious links or demands for money. Obtain consent before recording or sharing a conversation. This build only provides a waiting-to-connect call flow; it does not establish a live video call or deliver messages to a remote person.'],
    ['8. Events and group conduct', 'Keep event descriptions and participation information accurate. Do not arrange illegal, discriminatory or dangerous gatherings, misuse participant lists or harass anyone in an event group. Joining an event does not grant permission to contact someone privately. Verify the organizer, venue, time and any fees independently. For a first meeting, choose a public place, tell someone you trust and leave if you feel unsafe.'],
    ['9. No scams, spam or paid pressure', 'No fraud, phishing, impersonation, unsolicited advertising, bulk requests, fake engagement or requests for passwords, verification codes or financial details. Coins do not buy another person’s consent, a guaranteed match or permission to break these rules. Purchase availability and costs are described separately; never treat a failed purchase as successful.'],
    ['10. Reporting a concern', 'Use the Report entry in a person’s profile or chat safety menu, or report an event from its detail page. Choose the correct target and reason and provide relevant context without sharing unnecessary private information. Your saved reports can be found in Settings. In this build they are saved only on this device: they are not sent to a moderator and do not trigger a review, removal or response. Do not rely on a saved report for urgent help.'],
    ['11. Blocking and organizer controls', 'Use Block for unwanted contact and manage blocked accounts in Settings. Blocking filters that person from your discovery, matching, private chats and visible group content, and removes the current private connection, requests and conversation. Unblocking does not recreate deleted records. Blocking an organizer hides its recommended events while preserving events you already joined and their groups. These are account-scoped controls, not a service-wide suspension or a moderation decision.'],
    ['12. Safety handling and publication limits', 'The conduct rules above are required, but this build has no production content-screening service, moderation team, report-response channel or published operator contact. It cannot promise human review or a response time. Before a public social service is enabled, the operator must provide effective filtering before objectionable content is posted, report handling with timely responses, removal of violating content, action against abusive accounts, and accessible contact information. These requirements are release blockers, not capabilities supplied by this document.'],
  ],
  footer: 'No production moderation or support contact is configured. For urgent real-world danger, use campus security or local emergency services. These guidelines do not establish App Store approval.',
})
