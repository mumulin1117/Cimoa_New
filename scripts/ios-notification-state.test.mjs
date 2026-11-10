import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

test('notification state transitions and stale callback protection survive identifier changes', { timeout: 60000 }, t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cimoa-notification-state-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  const root = path.resolve(import.meta.dirname, '../ios/cimoaNeapo/ScholarWellnessPathfinder')
  const source = path.join(temporary, 'Graph.swift'), main = path.join(temporary, 'Main.swift')
  const executable = path.join(temporary, 'NotificationStateProbe')
  const graph = fs.readFileSync(path.join(root, 'CimosyllabusActivityGraph.swift'), 'utf8')
  assert.equal(graph.split('import UIKit').length, 2)
  fs.writeFileSync(source, graph.replace('import UIKit', 'import Foundation') + `
@MainActor final class UIApplication {
    static let shared = UIApplication()
    func registerForRemoteNotifications() { preconditionFailure("Registration must be injected") }
}
`)
  fs.writeFileSync(main, `import Foundation
import UserNotifications
@main struct NotificationStateProbe {
    @MainActor static func main() {
        func check(_ condition: @autoclosure () -> Bool, line: UInt = #line) {
            guard condition() else {
                FileHandle.standardError.write(Data(("Notification assertion failed at line " + String(line)).utf8))
                exit(1)
            }
        }
        func state(_ subject: CimosyllabusActivityGraph, _ expected: String) {
            let value = subject.researchWellnessPathfinder
            check(value["registration_status"] as? String == expected)
            check(value["provider_configured"] as? Bool == false)
            check(value["delivery_configured"] as? Bool == false)
        }
        let disabled = CimosyllabusActivityGraph(researchLanguageRhythm: false,
            libraryScheduleSignal: { _ in preconditionFailure("Disabled graph queried permissions") },
            researchCuriosityEngine: { preconditionFailure("Disabled graph registered") })
        state(disabled, "not_configured")
        disabled.libraryMobilityLens()
        disabled.libraryPersonalityTaxonomy(researchCampusWorkflow: Data([1]))
        disabled.libraryPathwayStudio()
        state(disabled, "not_configured")

        let ephemeral = UNAuthorizationStatus(rawValue: 4)!
        for authorization in [UNAuthorizationStatus.authorized, .provisional, ephemeral, .denied, .notDetermined] {
            var callbacks: [@MainActor (UNAuthorizationStatus) -> Void] = []
            var registrations = 0
            let subject = CimosyllabusActivityGraph(researchLanguageRhythm: true,
                libraryScheduleSignal: { callbacks.append($0) }, researchCuriosityEngine: { registrations += 1 })
            state(subject, "not_requested")
            subject.libraryMobilityLens()
            subject.libraryMobilityLens()
            check(callbacks.count == 1)
            state(subject, "checking_authorization")
            callbacks[0](authorization)
            switch authorization {
            case .authorized, .provisional, .ephemeral:
                check(registrations == 1)
                state(subject, "registering")
                subject.libraryMobilityLens()
                check(callbacks.count == 1 && registrations == 1)
                subject.libraryPersonalityTaxonomy(researchCampusWorkflow: Data([1, 2, 3]))
                state(subject, "registered")
            case .denied:
                check(registrations == 0)
                state(subject, "permission_denied")
            case .notDetermined:
                check(registrations == 0)
                state(subject, "authorization_required")
            @unknown default: preconditionFailure("Unexpected fixture authorization")
            }
        }

        var callbacks: [@MainActor (UNAuthorizationStatus) -> Void] = []
        var registrations = 0
        let subject = CimosyllabusActivityGraph(researchLanguageRhythm: true,
            libraryScheduleSignal: { callbacks.append($0) }, researchCuriosityEngine: { registrations += 1 })
        subject.libraryMobilityLens()
        subject.libraryPathwayStudio()
        callbacks[0](.authorized)
        check(registrations == 0)
        state(subject, "failed")
        check(subject.researchWellnessPathfinder["registration_error_code"] as? String == "apns_registration_failed")
        subject.libraryMobilityLens()
        check(callbacks.count == 2)
        subject.libraryPersonalityTaxonomy(researchCampusWorkflow: Data([4]))
        callbacks[1](.denied)
        state(subject, "registered")
        subject.libraryPersonalityTaxonomy(researchCampusWorkflow: Data())
        state(subject, "failed")
        print("notification_state:preserved_without_system_requests")
    }
}
`)
  execFileSync('xcrun', ['swiftc', '-parse-as-library', '-O', source, path.join(root, 'CimomusicOrientationPathfinder.swift'), main, '-o', executable], { timeout: 45000, stdio: 'pipe' })
  const output = execFileSync(executable, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
  assert.match(output, /notification_state:preserved_without_system_requests/)
  t.diagnostic('Authorization and registration callbacks injected; UIKit default guarded in a temporary host fixture. Real UIKit integration is compiled separately.')
})
