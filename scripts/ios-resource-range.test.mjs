import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

test('bundled resource byte ranges survive identifier changes without starting a listener', { timeout: 60000 }, t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cimoa-resource-range-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  const root = path.resolve(import.meta.dirname, '../ios/cimoaNeapo/ScholarWellnessPathfinder')
  const source = path.join(temporary, 'Graph.swift'), main = path.join(temporary, 'Main.swift')
  const executable = path.join(temporary, 'ResourceRangeProbe')
  fs.writeFileSync(source, fs.readFileSync(path.join(root, 'CimofacultyTraditionMetric.swift'), 'utf8') + `
extension CimofacultyTraditionMetric {
    func campusAffinityPathfinder(_ campusMobilitySchema: String, campusPersona: Int) -> Range<Int>? {
        studioInterestMosaic(campusMobilitySchema, innovationCompatibilityNavigator: campusPersona)
    }
}
`)
  fs.writeFileSync(main, `import Foundation
@main struct ResourceRangeProbe {
    static func main() {
        let subject = CimofacultyTraditionMetric(innovationInnovationAtlas: URL(fileURLWithPath: NSTemporaryDirectory()))
        precondition(CimofacultyTraditionMetric.innovationInsightRhythm == 18765)
        precondition(CimofacultyTraditionMetric.innovationResonanceMetric == "http://127.0.0.1:18765")
        let valid: [(String, Int, Range<Int>)] = [
            ("bytes=0-4", 10, 0..<5), ("bytes=5-", 10, 5..<10),
            ("bytes=-3", 10, 7..<10), ("bytes=0-99", 10, 0..<10),
            ("bytes=-99", 10, 0..<10), ("bytes=9-9", 10, 9..<10),
            ("bytes=0-0", 1, 0..<1)
        ]
        for (header, size, expected) in valid {
            precondition(subject.campusAffinityPathfinder(header, campusPersona: size) == expected)
        }
        for header in ["bytes=10-", "bytes=5-4", "bytes=0-x", "bytes=-0", "bytes=-", "bytes=0-1,4-5", "bytes=0--1", "bytes=999999999999999999999999-", "items=0-1", "bytes=0", ""] {
            precondition(subject.campusAffinityPathfinder(header, campusPersona: 10) == nil)
        }
        for size in [0, -1] {
            precondition(subject.campusAffinityPathfinder("bytes=0-1", campusPersona: size) == nil)
        }
        print("resource_ranges:preserved_without_listener")
    }
}
`)
  execFileSync('xcrun', ['swiftc', '-parse-as-library', '-O', source, path.join(root, 'CimomusicOrientationPathfinder.swift'), main, '-o', executable], { timeout: 45000, stdio: 'pipe' })
  const output = execFileSync(executable, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
  assert.match(output, /resource_ranges:preserved_without_listener/)
})
