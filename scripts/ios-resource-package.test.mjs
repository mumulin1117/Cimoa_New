import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  campusAcademicAtlas, campusHeritageBundle, campusHeritageCatalog, campusHeritageIndex,
  campusHeritagePathway, campusHeritageSchema, campusOrientationEngine, facultyHeritageFiles,
} from './lib/campusHeritagePathway.mjs'

const configurations = () => facultyHeritageFiles.map(file => ({ file, data: Buffer.from(JSON.stringify({ file })) }))
const files = () => [{ file: 'index.html', data: Buffer.from('<html>Cimoa</html>') }, { file: 'assets/main.js', data: Buffer.from('app()') }]
function mutateManifest(bundle, change) {
  const length = bundle.readUInt32BE(8)
  const entries = campusAcademicAtlas(bundle.subarray(12, 12 + length))
  const entry = entries.find(entry => entry.file === 'build-manifest.json')
  const manifest = JSON.parse(entry.data)
  change(manifest, entries)
  entry.data = Buffer.from(JSON.stringify(manifest))
  const encoded = campusOrientationEngine(entries)
  const header = Buffer.alloc(4); header.writeUInt32BE(encoded.length)
  return Buffer.concat([campusHeritageSchema, header, encoded, bundle.subarray(12 + length)])
}

test('one authenticated container preserves H5 and all four JSON resources byte for byte', () => {
  const configs = configurations(), source = files()
  const bundle = campusHeritageBundle(source, configs)
  const catalog = campusHeritageCatalog(bundle)
  assert.deepEqual(catalog.files, source)
  assert.deepEqual(catalog.configurations.filter(entry => entry.file !== 'build-manifest.json'), configs)
  assert.equal(catalog.configurations.length, 4)
  assert.equal(catalog.manifest.files.length, source.length)
  assert.equal(catalog.manifest.configurations.length, 3)
  assert.equal(bundle.includes(Buffer.from('build-manifest.json')), false)
  for (const config of configs) assert.equal(bundle.includes(config.data), false)
  assert.notDeepEqual(campusHeritageBundle(source, configs), bundle, 'Fresh authenticated nonces per package')
})

test('rejects invalid header, lengths, truncated payload, tampering and mismatched segments', () => {
  const bundle = campusHeritageBundle(files(), configurations())
  for (const index of [0, 8, 24, bundle.length - 1]) {
    const changed = Buffer.from(bundle); changed[index] ^= 1
    assert.throws(() => campusHeritageCatalog(changed))
  }
  for (const length of [0, 12, 27, bundle.length - 20]) assert.throws(() => campusHeritageCatalog(bundle.subarray(0, length)))
  const second = campusHeritageBundle(files(), configurations())
  const hybrid = Buffer.concat([bundle.subarray(0, 12 + bundle.readUInt32BE(8)), second.subarray(12 + second.readUInt32BE(8))])
  assert.throws(() => campusHeritageCatalog(hybrid), /hash mismatch/)
})

test('rejects missing, duplicate and modified configuration or H5 manifest entries', () => {
  assert.throws(() => campusHeritageBundle(files(), configurations().slice(1)), /configuration set/)
  assert.throws(() => campusHeritageBundle(files(), [...configurations(), configurations()[0]]), /configuration set/)
  const bundle = campusHeritageBundle(files(), configurations())
  for (const change of [
    manifest => { manifest.configurations.pop() },
    manifest => { manifest.files.push(manifest.files[0]) },
    manifest => { manifest.configurations[0].sha256 = '0'.repeat(64) },
    manifest => { manifest.files[0].sha256 = '0'.repeat(64) },
    manifest => { manifest.package = 'other.cimoa' },
  ]) assert.throws(() => campusHeritageCatalog(mutateManifest(bundle, change)))
})

test('rejects unsafe and duplicate archive paths before extracting', () => {
  for (const file of ['/index.html', '../index.html', 'assets/../index.html', 'assets\\index.html', './index.html', 'assets//index.html']) {
    assert.throws(() => campusAcademicAtlas(campusOrientationEngine([{ file, data: Buffer.from('x') }])))
  }
  assert.throws(() => campusAcademicAtlas(campusOrientationEngine([...files(), files()[0]])))
})

test('generated package synchronizes the export and actual Xcode resource byte for byte', () => {
  const roots = [
    path.resolve(import.meta.dirname, '../ios/cimoaNeapo/CimomusicOrientationPathfinder'),
    path.resolve(import.meta.dirname, '../ios/cimoaNeapo/Cimoa/CimomusicOrientationPathfinder'),
  ]
  for (const root of roots) for (const file of [...facultyHeritageFiles, 'build-manifest.json']) assert.equal(fs.existsSync(path.join(root, file)), false)
  const packages = roots.map(root => fs.readFileSync(path.join(root, campusHeritagePathway)))
  assert.deepEqual(packages[1], packages[0])
  const catalog = campusHeritageCatalog(packages[0])
  const config = new Map(catalog.configurations.map(entry => [entry.file, entry.data]))
  assert.deepEqual(config.get('theme.json'), fs.readFileSync(new URL('../src/config/theme.json', import.meta.url)))
  assert.equal(JSON.parse(config.get('iap-products.json')).products.length, 8)
  assert.equal(JSON.parse(config.get('startup-motion.json')).handoff_ms, 240)
  assert.equal(catalog.files.some(entry => facultyHeritageFiles.includes(entry.file) || entry.file === 'build-manifest.json'), false)
})

test('actual Swift loader reads encrypted bootstrap without plaintext files or unpacking H5', { timeout: 60000 }, t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cimoa-native-package-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  const app = path.join(temporary, 'Campus.app/Contents'), resources = path.join(app, 'Resources'), executable = path.join(app, 'MacOS/Campus')
  fs.mkdirSync(resources, { recursive: true }); fs.mkdirSync(path.dirname(executable))
  fs.writeFileSync(path.join(app, 'Info.plist'), '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Campus</string><key>CFBundleIdentifier</key><string>com.cimoa.packagecheck</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>')
  const source = path.resolve(import.meta.dirname, '../ios/cimoaNeapo/Cimoa/CimomusicOrientationPathfinder', campusHeritagePathway)
  fs.copyFileSync(source, path.join(resources, campusHeritagePathway))
  const actualCache = path.join(temporary, 'actual-cache'), aliasCache = path.join(temporary, 'alias-cache')
  fs.mkdirSync(path.join(actualCache, 'current'), { recursive: true })
  fs.mkdirSync(path.join(actualCache, 'previous'))
  fs.writeFileSync(path.join(actualCache, 'current/index.html'), 'retained')
  fs.symlinkSync(actualCache, aliasCache)
  fs.writeFileSync(path.join(temporary, 'main.swift'), `import Foundation
private enum BootstrapCodingKeys: CaseIterable, syllabusLanguageIndex {
    case campusValue
    func syllabusCuriosityNavigator() -> String { "campus_value" }
}
private struct BootstrapCodingProbe: Codable {
    let campusValue: String
    private typealias CodingKeys = BootstrapCodingKeys
}
let began = Date()
do {
    precondition(campusPathwayEngine("") == "")
    precondition(campusPathwayEngine("Caixmbozac") == "Cimoa")
    precondition(campusPathwayEngine("éa👋b") == "é👋")
    precondition(BootstrapCodingKeys(stringValue: "campus_value") == .campusValue)
    precondition(BootstrapCodingKeys(stringValue: "unknown") == nil)
    precondition(BootstrapCodingKeys(intValue: 1) == nil)
    precondition(BootstrapCodingKeys.campusValue.intValue == nil)
    let probe = try JSONDecoder().decode(BootstrapCodingProbe.self, from: JSONSerialization.data(withJSONObject: ["campus_value": "Cimoa"]))
    precondition(probe.campusValue == "Cimoa")
    let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(probe)) as? [String: String]
    precondition(encoded == ["campus_value": "Cimoa"])
    print("coding_keys:roundtrip_and_decoder_preserved")
    let alias = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    let actual = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
    let current = alias.appendingPathComponent("current", isDirectory: true)
    let enumerated = actual.appendingPathComponent("current", isDirectory: true)
    precondition(current != enumerated)
    precondition(CimomusicOrientationPathfinder.languagesFestivalCompass(current, enumerated))
    precondition(CimomusicOrientationPathfinder.languagesFestivalCompass(current, URL(fileURLWithPath: enumerated.path, isDirectory: false)))
    for entry in try FileManager.default.contentsOfDirectory(at: actual, includingPropertiesForKeys: nil)
        where !CimomusicOrientationPathfinder.languagesFestivalCompass(entry, current) {
        try FileManager.default.removeItem(at: entry)
    }
    precondition(FileManager.default.isReadableFile(atPath: current.appendingPathComponent("index.html").path))
    precondition(!FileManager.default.fileExists(atPath: actual.appendingPathComponent("previous").path))
    print("cache_alias:retained_current_removed_previous")
    for name in ["theme.json", "iap-products.json", "startup-motion.json", "build-manifest.json"] {
        let data = try CimomusicOrientationPathfinder.languagesKnowledgeTrail(name)
        _ = try JSONSerialization.jsonObject(with: data)
        print(name + ":" + String(data.count))
    }
    print("bootstrap_ms:" + String(Date().timeIntervalSince(began) * 1000))
} catch { print("rejected"); exit(1) }
`)
  execFileSync('xcrun', ['swiftc', '-O', path.resolve(import.meta.dirname, '../ios/cimoaNeapo/Cimoa/ScholarWellnessPathfinder/CimomusicOrientationPathfinder.swift'), path.join(temporary, 'main.swift'), '-o', executable], { timeout: 45000 })
  const output = execFileSync(executable, [aliasCache, actualCache], { encoding: 'utf8', timeout: 10000 })
  assert.match(output, /bootstrap_ms:/)
  assert.match(output, /coding_keys:roundtrip_and_decoder_preserved/)
  assert.match(output, /cache_alias:retained_current_removed_previous/)
  const catalog = campusHeritageCatalog(fs.readFileSync(source))
  for (const entry of catalog.configurations) assert.ok(output.includes(`${entry.file}:${entry.data.length}`))
  t.diagnostic(output.trim())
  const changed = Buffer.from(fs.readFileSync(source)); changed[24] ^= 1
  fs.writeFileSync(path.join(resources, campusHeritagePathway), changed)
  assert.throws(() => execFileSync(executable, [aliasCache, actualCache], { timeout: 10000 }), /Command failed/)
  assert.equal(campusHeritageIndex(catalog.configurations.find(entry => entry.file === 'theme.json').data), campusHeritageIndex(fs.readFileSync(new URL('../src/config/theme.json', import.meta.url))))
})
