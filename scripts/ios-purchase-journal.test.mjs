import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

test('native purchase journal preserves every serialized state and existing keys after identifier changes', { timeout: 60000 }, t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cimoa-purchase-journal-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  const root = path.resolve(import.meta.dirname, '../ios/cimoaNeapo/ScholarWellnessPathfinder')
  const source = path.join(temporary, 'Engine.swift')
  const main = path.join(temporary, 'Main.swift')
  const executable = path.join(temporary, 'JournalProbe')
  fs.writeFileSync(source, fs.readFileSync(path.join(root, 'CimocampusPathwayEngine.swift'), 'utf8') + `
extension CimocampusPathwayEngine {
    static func facultyTraditionWorkflow(_ facultyAcademicToolkit: Data) throws -> Data {
        let facultyPathwayEngine = try JSONDecoder().decode(campusTraditionPattern.self, from: facultyAcademicToolkit)
        try lectureAcademicBlueprint(facultyPathwayEngine)
        return try JSONEncoder().encode(facultyPathwayEngine)
    }
}
`)
  fs.writeFileSync(main, `import Foundation
@main struct facultyAffinityPathfinder {
    @MainActor static func main() {
        do {
            let facultyMobilitySchema = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
            let facultyPersonalityDirectory = try CimocampusPathwayEngine.facultyTraditionWorkflow(facultyMobilitySchema)
            FileHandle.standardOutput.write(facultyPersonalityDirectory)
        } catch {
            FileHandle.standardError.write(Data("Journal rejected".utf8))
            exit(1)
        }
    }
}
`)
  execFileSync('xcrun', ['swiftc', '-parse-as-library', '-O', source, path.join(root, 'CimomusicOrientationPathfinder.swift'), main, '-o', executable], { timeout: 45000, stdio: 'pipe' })
  const owner = 'journal-owner', request = 'journal-request', product = 'journal-product', pack = 'journal-package'
  const accountToken = '88D6ABCF-AF8A-4D5E-B4AD-08131A663673'
  const states = ['queued', 'initiated', 'submitted', 'pending', 'interrupted', 'abandoned', 'delivered', 'completed', 'cancelled', 'failed', 'revoked']
  const fixture = state => ({
    version: 1,
    accountTokens: { [owner]: accountToken },
    requests: {
      [request]: {
        request: { requestID: request, packageID: pack, ownerUserID: owner, productID: product },
        accountToken, createdAt: 1000, state, transactionID: 'journal-transaction',
      },
    },
    deliveries: {
      'journal-transaction': {
        requestID: request, packageID: pack, ownerUserID: owner, productID: product,
        transactionID: 'journal-transaction', originalTransactionID: 'journal-original',
        appAccountToken: accountToken, signedTransaction: 'journal-proof', purchasedAt: 2000,
      },
    },
    acknowledged: { 'journal-acknowledged': { ownerUserID: owner, packageID: pack, productID: product } },
    revoked: { 'journal-revoked': { productID: product, revokedAt: 3000 } },
  })
  const input = path.join(temporary, 'journal.json')
  const run = value => {
    fs.writeFileSync(input, JSON.stringify(value))
    return execFileSync(executable, [input], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
  }
  for (const state of states) {
    const expected = fixture(state)
    assert.deepEqual(JSON.parse(run(expected)), expected, `Journal keys or state changed: ${state}`)
  }
  const noRevocations = fixture('pending'); delete noRevocations.revoked
  assert.deepEqual(JSON.parse(run(noRevocations)), noRevocations, 'Older journals without optional revocations remain compatible')
  const invalidVersion = fixture('pending'); invalidVersion.version = 2
  const invalidOwner = fixture('pending'); invalidOwner.deliveries['journal-transaction'].ownerUserID = 'different-owner'
  for (const invalid of [fixture('unknown-state'), invalidVersion, invalidOwner]) {
    assert.throws(() => run(invalid), /Journal rejected/)
  }
  t.diagnostic('11 states, all six CodingKeys mappings, optional legacy data and invalid journal rejection verified without StoreKit purchases.')
})
