// Bounded companion for HostTests.testAutoMatchFullRecoveryFlow.
// Launch actual Settings and return the same test-host process; never forge a
// background event or acknowledge the handshake before the OS round trip.
import fs from 'node:fs'
import cp from 'node:child_process'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
const folder = 'docs/evidence/auto-match', ready = folder + '/native-background-ready.txt'
const simulator = 'D9B138D2-1B08-4646-B8D0-8A2242AECD7D', bundle = 'com.cimoa.neapo.dev'
const token = () => fs.existsSync(ready) ? fs.readFileSync(ready, 'utf8').trim() : ''
const initial = token(), command = args => cp.execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', timeout: 10000 }).trim()
console.log('Bounded background companion PID ' + process.pid + ': waiting up to 30 seconds for a new XCTest token')
let current = ''
for (let i = 0; i < 120; i++) { current = token(); if (current && current !== initial) break; await delay(250) }
assert.ok(current && current !== initial && /^[A-Fa-f0-9-]{36}$/.test(current), 'No new native test handshake within 30 seconds')
const before = command(['launch', simulator, bundle]), began = Date.now()
let settings
try { settings = command(['launch', simulator, 'com.apple.Preferences']); await delay(1500) }
finally {
  const after = command(['launch', simulator, bundle])
  assert.equal(after, before, 'Background recovery must keep the same test-host PID')
}
fs.writeFileSync(folder + '/native-background-done.txt', current)
fs.writeFileSync('docs/evidence/sync-recovery/native-background.json', JSON.stringify({ result: 'passed', simulator, token: current, companion_pid: process.pid, before, settings, elapsed_ms: Date.now() - began, scope: 'Actual simulator Settings foreground and return to the same Cimoa process; not physical-device multitasking', cleaned_up: true }, null, 2) + '\n')
console.log('PASS Actual Settings foreground and same-process Cimoa recovery acknowledged')
