import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { exportStandalone, productionProject, readProject, validateStandalone } from './lib/iosStandalone.mjs'
import { campusHeritageBundle, campusHeritagePathway, facultyHeritageFiles } from './lib/campusHeritagePathway.mjs'

const id = value => value.toString(16).padStart(24, '0').toUpperCase()
function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cimoa-ios-standalone-test-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  const root = path.join(temporary, 'source')
  const files = {
    'ScholarWellnessPathfinder/App.swift': 'import UIKit\n',
    'Config/Info.plist': '<plist/>',
    'Config/Local.xcconfig': 'INFOPLIST_FILE = Config/Info.plist\n',
    'Assets.xcassets/Contents.json': '{}',
    'Launch Screen.storyboard': '<document/>',
    'Tests/HostTests.swift': '// retained in source only\n',
    'README.md': '# Cimoa\n',
    'build/user-cache.txt': 'do not touch',
    'node_modules/user-cache.txt': 'do not export'
  }
  for (const [name, value] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    fs.writeFileSync(path.join(root, name), value)
  }
  const academicFiles = [{ file: 'index.html', data: Buffer.from('<!doctype html><div id="app"></div>') }]
  const festivalPackage = campusHeritageBundle(academicFiles, facultyHeritageFiles.map(file => ({ file, data: Buffer.from('{}') })))
  fs.mkdirSync(path.join(root, 'CimomusicOrientationPathfinder'), { recursive: true })
  fs.writeFileSync(path.join(root, `CimomusicOrientationPathfinder/${campusHeritagePathway}`), festivalPackage)
  const objects = {
    [id(1)]: { isa: 'PBXProject', mainGroup: id(2), productRefGroup: id(6), projectDirPath: '', projectRoot: '', targets: [id(20), id(21)], attributes: { TargetAttributes: { [id(20)]: {}, [id(21)]: { TestTargetID: id(20) } } } },
    [id(2)]: { isa: 'PBXGroup', sourceTree: '<group>', children: [id(3), id(4), id(5), id(6), id(7)] },
    [id(3)]: { isa: 'PBXGroup', path: 'ScholarWellnessPathfinder', sourceTree: '<group>', children: [id(10)] },
    [id(4)]: { isa: 'PBXGroup', path: 'CimomusicOrientationPathfinder', sourceTree: '<group>', children: [id(11)] },
    [id(5)]: { isa: 'PBXGroup', path: 'Tests', sourceTree: '<group>', children: [id(12)] },
    [id(6)]: { isa: 'PBXGroup', name: 'Products', sourceTree: '<group>', children: [id(13), id(14)] },
    [id(7)]: { isa: 'PBXGroup', path: 'Config', sourceTree: '<group>', children: [id(15)] },
    [id(10)]: { isa: 'PBXFileReference', path: 'App.swift', sourceTree: '<group>' },
    [id(11)]: { isa: 'PBXFileReference', path: campusHeritagePathway, sourceTree: '<group>' },
    [id(12)]: { isa: 'PBXFileReference', path: 'HostTests.swift', sourceTree: '<group>' },
    [id(13)]: { isa: 'PBXFileReference', path: 'cimoaNeapo.app', sourceTree: 'BUILT_PRODUCTS_DIR' },
    [id(14)]: { isa: 'PBXFileReference', path: 'cimoaNeapoTests.xctest', sourceTree: 'BUILT_PRODUCTS_DIR' },
    [id(15)]: { isa: 'PBXFileReference', path: 'Local.xcconfig', sourceTree: '<group>' },
    [id(20)]: { isa: 'PBXNativeTarget', productType: 'com.apple.product-type.application', productReference: id(13), buildPhases: [id(30)], dependencies: [] },
    [id(21)]: { isa: 'PBXNativeTarget', productType: 'com.apple.product-type.bundle.unit-test', productReference: id(14), buildPhases: [id(31)], buildConfigurationList: id(40), dependencies: [id(42)] },
    [id(30)]: { isa: 'PBXSourcesBuildPhase', files: [id(32)] },
    [id(31)]: { isa: 'PBXSourcesBuildPhase', files: [id(33)] },
    [id(32)]: { isa: 'PBXBuildFile', fileRef: id(10) },
    [id(33)]: { isa: 'PBXBuildFile', fileRef: id(12) },
    [id(40)]: { isa: 'XCConfigurationList', buildConfigurations: [id(41)] },
    [id(41)]: { isa: 'XCBuildConfiguration', buildSettings: { TEST_HOST: '$(BUILT_PRODUCTS_DIR)/cimoaNeapo.app/cimoaNeapo' } },
    [id(42)]: { isa: 'PBXTargetDependency', target: id(20), targetProxy: id(43) },
    [id(43)]: { isa: 'PBXContainerItemProxy', containerPortal: id(1), remoteGlobalIDString: id(20) }
  }
  const document = { archiveVersion: '1', objectVersion: '56', classes: {}, objects, rootObject: id(1) }
  const project = path.join(root, 'cimoaNeapo.xcodeproj')
  fs.mkdirSync(path.join(project, 'xcshareddata/xcschemes'), { recursive: true })
  fs.writeFileSync(path.join(project, 'project.pbxproj'), JSON.stringify(document))
  fs.writeFileSync(path.join(project, 'xcshareddata/xcschemes/cimoaNeapo.xcscheme'), `<?xml version="1.0"?><Scheme><BuildAction><BuildActionEntries><BuildActionEntry><BuildableReference BlueprintIdentifier="${id(20)}" ReferencedContainer="container:cimoaNeapo.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction><Testables><TestableReference><BuildableReference BlueprintIdentifier="${id(21)}" ReferencedContainer="container:cimoaNeapo.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>`)
  return { root, document, output: path.join(temporary, 'export') }
}

test('resolves physical parent groups and hashes every H5 file', t => {
  const { root, document } = fixture(t)
  assert.equal(validateStandalone(root, document).h5_files, 1)
  assert.equal(validateStandalone(root, document).file_references, 4)
})

test('rejects missing file references and unresolved build-file objects', t => {
  const { root, document } = fixture(t)
  document.objects[id(10)].path = 'Missing.swift'
  assert.throws(() => validateStandalone(root, document), /missing file/)
  document.objects[id(10)].path = 'App.swift'
  document.objects[id(32)].fileRef = id(999)
  assert.throws(() => validateStandalone(root, document), /unresolved object reference/)
})

test('rejects external group and absolute file references', t => {
  const { root, document } = fixture(t)
  document.objects[id(3)].path = '../../outside'
  assert.throws(() => validateStandalone(root, document), /external path/)
  document.objects[id(3)].path = 'ScholarWellnessPathfinder'
  document.objects[id(10)].path = '/tmp/outside.swift'
  assert.throws(() => validateStandalone(root, document), /external file reference/)
})

test('rejects symlinks even when their target is inside the project', t => {
  const { root, document } = fixture(t)
  fs.symlinkSync('App.swift', path.join(root, 'ScholarWellnessPathfinder/Linked.swift'))
  assert.throws(() => validateStandalone(root, document), /symbolic link/)
})

test('rejects modified packages, plaintext configurations, duplicate and prototype H5 resources', t => {
  const { root, document } = fixture(t)
  const resources = path.join(root, 'CimomusicOrientationPathfinder')
  const archive = path.join(resources, campusHeritagePathway)
  const changed = Buffer.from(fs.readFileSync(archive)); changed[20] ^= 1; fs.writeFileSync(archive, changed)
  assert.throws(() => validateStandalone(root, document), /cannot be decrypted/)
  const facultyFiles = facultyHeritageFiles.map(file => ({ file, data: Buffer.from('{}') }))
  const academicFiles = [{ file: 'index.html', data: Buffer.from('changed') }]
  const festivalPackage = campusHeritageBundle(academicFiles, facultyFiles)
  fs.writeFileSync(archive, festivalPackage)
  fs.writeFileSync(path.join(resources, 'theme.json'), '{}')
  assert.throws(() => validateStandalone(root, document), /plaintext packaged configuration/)
  fs.unlinkSync(path.join(resources, 'theme.json'))
  fs.writeFileSync(archive, campusHeritageBundle([...academicFiles, ...academicFiles], facultyFiles))
  assert.throws(() => validateStandalone(root, document), /cannot be decrypted/)
  const prototypeFiles = [{ file: 'index.html', data: Buffer.from('changed') }, { file: 'CIRCA interactive.html', data: Buffer.from('prototype') }]
  const prototypePackage = campusHeritageBundle(prototypeFiles, facultyFiles)
  fs.writeFileSync(archive, prototypePackage)
  assert.throws(() => validateStandalone(root, document), /prototype resource/)
})

test('rejects external build inputs and build scripts', t => {
  const { root, document } = fixture(t)
  fs.writeFileSync(path.join(root, 'Config/Local.xcconfig'), 'INFOPLIST_FILE = ../../outside.plist\n')
  assert.throws(() => validateStandalone(root, document), /external path/)
  fs.writeFileSync(path.join(root, 'Config/Local.xcconfig'), 'INFOPLIST_FILE = Config/Info.plist\n')
  document.objects[id(90)] = { isa: 'PBXShellScriptBuildPhase', shellScript: 'node ../../scripts/package-ios.mjs' }
  assert.throws(() => validateStandalone(root, document), /external build scripts/)
  document.objects[id(90)] = { isa: 'PBXBuildRule', script: 'node ../../scripts/package-ios.mjs' }
  assert.throws(() => validateStandalone(root, document), /external build scripts/)
})

test('rejects scheme pre/post execution scripts instead of copying build dependencies', t => {
  const { root, output } = fixture(t)
  const scheme = path.join(root, 'cimoaNeapo.xcodeproj/xcshareddata/xcschemes/cimoaNeapo.xcscheme')
  fs.writeFileSync(scheme, '<Scheme><BuildAction><PreActions><ExecutionAction ActionType="Xcode.IDEStandardExecutionActionsCore.ExecutionActionType.ShellScriptAction"><ActionContent scriptText="node ../../scripts/package-ios.mjs"/></ExecutionAction></PreActions></BuildAction></Scheme>')
  assert.throws(() => exportStandalone(root, output), /scheme build scripts/)
})

test('production graph strips tests and orphan objects without mutating original', t => {
  const { document } = fixture(t)
  const original = structuredClone(document)
  const copy = productionProject(document)
  assert.deepEqual(document, original)
  for (const removed of [5, 12, 14, 21, 31, 33, 40, 41, 42, 43]) assert.equal(copy.objects[id(removed)], undefined)
  assert.deepEqual(copy.objects[id(1)].targets, [id(20)])
  for (const object of Object.values(copy.objects)) if (object.isa === 'PBXBuildFile') assert.ok(copy.objects[object.fileRef])
})

test('exports a production-only folder and scheme, preserving source tests and existing outputs', t => {
  const { root, output } = fixture(t)
  const sourceProject = fs.readFileSync(path.join(root, 'cimoaNeapo.xcodeproj/project.pbxproj'))
  const report = exportStandalone(root, output)
  assert.equal(report.h5_files, 1)
  for (const omitted of ['Tests', 'build', 'node_modules']) assert.equal(fs.existsSync(path.join(output, omitted)), false)
  assert.deepEqual(fs.readFileSync(path.join(root, 'cimoaNeapo.xcodeproj/project.pbxproj')), sourceProject)
  assert.equal(fs.readFileSync(path.join(root, 'Tests/HostTests.swift'), 'utf8'), '// retained in source only\n')
  const scheme = path.join(output, 'cimoaNeapo.xcodeproj/xcshareddata/xcschemes/cimoaNeapo.xcscheme')
  assert.equal(execFileSync('/usr/bin/xmllint', ['--xpath', 'count(//Testables/*)', scheme], { encoding: 'utf8' }).trim(), '0')
  assert.equal(readProject(output).objects[id(21)], undefined)
  fs.writeFileSync(path.join(output, 'signing-edits.txt'), 'keep')
  assert.throws(() => exportStandalone(root, output), /output already exists/)
  assert.equal(fs.readFileSync(path.join(output, 'signing-edits.txt'), 'utf8'), 'keep')
})
