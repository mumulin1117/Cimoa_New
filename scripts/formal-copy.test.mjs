import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { toast_message } from '../src/utils/toast.js'
import { auth_message } from '../src/utils/authFeedback.js'
import { terms_document, privacy_document, community_document, eula_document } from '../src/utils/legalDocuments.js'
import { report_status_label } from '../src/utils/reportPresentation.js'

test('legacy adapter environment descriptions cannot escape through Toast or auth feedback', () => {
  for (const message of [
    'Local account is unavailable.', 'Demo data loaded.', 'Local social mode is ready.',
    'Test account unavailable.', 'Mock data is unavailable.', 'Simulation mode is enabled.',
    'Development environment is unavailable.', 'This build does not support sending.',
    'This account exists on this device.', 'Your information was stored on this device.',
    'Available on this device only.',
  ]) {
    assert.equal(toast_message(message, 'error'), 'This action couldn’t be completed. Please try again.', message)
    assert.equal(auth_message(message), 'This action couldn’t be completed. Please try again.', message)
  }
})

test('formal errors keep actionable permission, delivery, payment and storage boundaries', () => {
  for (const message of [
    'Microphone permission was denied.', 'Your message has not been sent.',
    'Delivery and moderation have not been confirmed.', 'Purchases are currently unavailable.',
    'Your device doesn’t have enough space. Free up some space and try again.',
  ]) assert.equal(toast_message(message, 'error'), message)
  assert.equal(report_status_label('local_saved'), 'Not delivered')
})

test('canonical documents use formal language without inventing verification, delivery or recovery', () => {
  for (const document of [terms_document, privacy_document, community_document, eula_document]) {
    assert.doesNotMatch(JSON.stringify(document), /\b(?:demo|local account|local data|local demo|local social|this build|development environment|browser storage|app storage)\b/i)
  }
  const privacy = JSON.stringify(privacy_document)
  assert.match(privacy, /retains the account and activity information you provide within the app/)
  assert.match(privacy, /does not itself transmit that content to another person/)
  assert.match(privacy, /does not confirm delivery, reading or a response/)
  assert.match(privacy, /does not confirm delivery to a moderation or support team, create a support ticket or indicate human review/)
  assert.match(privacy, /do not establish email ownership or university enrollment/)
  assert.match(privacy, /coins are added only after Apple confirms the transaction/)
  assert.match(privacy, /Recovery of removed content and synchronization across devices are not provided/)
  assert.doesNotMatch(privacy, /we send a verification email|we review every report|delivered to our team|automatically sync|cloud backup is available/i)
})

test('copy cleanup retains the bundle transport, stable origin and real native capability guards', () => {
  const server = fs.readFileSync('ios/cimoaNeapo/Sources/BundleHTTPServer.swift', 'utf8')
  const host = fs.readFileSync('ios/cimoaNeapo/Sources/WebViewController.swift', 'utf8')
  assert.match(server, /parameters\.requiredLocalEndpoint = \.hostPort\(host: "127\.0\.0\.1"/)
  assert.match(server, /\["GET", "HEAD"\]\.contains\(request\[0\]\)/)
  assert.match(server, /file\.path\.hasPrefix\(root\.path \+ "\/"\)/)
  assert.match(host, /BundleHTTPServer\(root: root\)/)
  assert.match(host, /webView\.load\(URLRequest\(url: URL\(string: BundleHTTPServer\.origin/)
  assert.match(host, /origin\.protocol == "http", origin\.host == "127\.0\.0\.1"/)
})
