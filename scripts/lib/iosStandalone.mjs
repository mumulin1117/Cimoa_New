// Production export only. The repository's test target and fixtures stay untouched.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { campusHeritageCatalog, campusHeritagePathway, facultyHeritageFiles } from './campusHeritagePathway.mjs'

const projectName = 'cimoaNeapo.xcodeproj'
const productionFiles = ['ScholarWellnessPathfinder', 'Config', 'CimomusicOrientationPathfinder', 'Assets.xcassets', 'Launch Screen.storyboard', 'README.md']
const groupTypes = new Set(['PBXGroup', 'PBXVariantGroup'])
const objectID = /^[A-Fa-f0-9]{24}$/
const within = (root, file) => file === root || (!path.relative(root, file).startsWith(`..${path.sep}`) && path.relative(root, file) !== '..' && !path.isAbsolute(path.relative(root, file)))
const fail = message => { throw Error(`iOS standalone: ${message}`) }

export function readProject(projectRoot) {
  const root = path.resolve(projectRoot)
  const file = checkedPath(root, path.join(root, projectName, 'project.pbxproj'))
  return JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' }))
}

function checkedPath(root, candidate) {
  if (!within(root, candidate)) fail(`external path: ${candidate}`)
  let current = root
  for (const part of path.relative(root, candidate).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    let stat
    try { stat = fs.lstatSync(current) } catch { fail(`missing file: ${current}`) }
    if (stat.isSymbolicLink()) fail(`symbolic link: ${current}`)
  }
  return candidate
}

function filesUnder(root, candidate) {
  checkedPath(root, candidate)
  const stat = fs.lstatSync(candidate)
  if (!stat.isDirectory()) return [candidate]
  return fs.readdirSync(candidate).flatMap(name => filesUnder(root, path.join(candidate, name)))
}

function references(value, objects, output = new Set()) {
  if (typeof value === 'string' && Object.hasOwn(objects, value)) output.add(value)
  else if (Array.isArray(value)) value.forEach(entry => references(entry, objects, output))
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (Object.hasOwn(objects, key)) output.add(key)
      references(entry, objects, output)
    }
  }
  return output
}

function assertReferences(document) {
  const objects = document.objects
  if (!objects?.[document.rootObject]) fail('missing root project object')
  const inspect = (value, field) => {
    if (typeof value === 'string' && objectID.test(value) && !Object.hasOwn(objects, value)) fail(`unresolved object reference: ${field} = ${value}`)
    if (Array.isArray(value)) value.forEach(entry => inspect(entry, field))
    else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) inspect(entry, key)
  }
  Object.values(objects).forEach(object => inspect(object, object.isa))
}

export function productionProject(document) {
  const copy = structuredClone(document)
  const objects = copy.objects
  const root = objects[copy.rootObject]
  const applicationIDs = root.targets.filter(id => objects[id]?.productType === 'com.apple.product-type.application')
  if (applicationIDs.length !== 1) fail('expected exactly one application target')
  const application = applicationIDs[0]
  const removedTargets = root.targets.filter(id => id !== application)
  const removedProducts = new Set(removedTargets.map(id => objects[id].productReference))
  const removedGroups = new Set(Object.entries(objects).filter(([, object]) => groupTypes.has(object.isa) && (object.path === 'Tests' || object.name === 'Tests')).map(([id]) => id))
  root.targets = [application]
  if (root.attributes?.TargetAttributes) for (const id of removedTargets) delete root.attributes.TargetAttributes[id]
  for (const object of Object.values(objects)) {
    if (groupTypes.has(object.isa)) object.children = object.children.filter(id => !removedGroups.has(id) && !removedProducts.has(id))
    if (object.isa === 'PBXNativeTarget') object.dependencies = (object.dependencies || []).filter(id => !removedTargets.includes(objects[id]?.target))
  }
  const keep = new Set()
  const visit = id => {
    if (keep.has(id)) return
    keep.add(id)
    for (const child of references(objects[id], objects)) visit(child)
  }
  visit(copy.rootObject)
  for (const id of Object.keys(objects)) if (!keep.has(id)) delete objects[id]
  assertReferences(copy)
  if (Object.values(objects).some(object => object.productType?.includes('unit-test') || object.productType?.includes('ui-testing'))) fail('test target survived export')
  return copy
}

function validateBuildPaths(root, document) {
  const check = (value, key) => {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (!item || item === '$(inherited)' || item === '${inherited}') continue
      const resolved = item.replace(/\$\((?:SRCROOT|SOURCE_ROOT|PROJECT_DIR)\)|\$\{(?:SRCROOT|SOURCE_ROOT|PROJECT_DIR)\}/g, root)
      if (resolved.includes('$')) fail(`unsupported build input variable: ${key} = ${item}`)
      checkedPath(root, path.resolve(root, resolved))
    }
  }
  const inputKey = /^(INFOPLIST_FILE|CODE_SIGN_ENTITLEMENTS|SWIFT_OBJC_BRIDGING_HEADER|GCC_PREFIX_HEADER|HEADER_SEARCH_PATHS|USER_HEADER_SEARCH_PATHS|FRAMEWORK_SEARCH_PATHS|LIBRARY_SEARCH_PATHS|SWIFT_INCLUDE_PATHS)$/
  for (const object of Object.values(document.objects)) {
    if ((object.isa === 'PBXShellScriptBuildPhase' && object.shellScript?.trim()) || (object.isa === 'PBXBuildRule' && object.script?.trim())) fail('external build scripts are not allowed')
    if (/XCRemoteSwiftPackageReference|XCSwiftPackageProductDependency|PBXReferenceProxy/.test(object.isa)) fail(`external build dependency: ${object.isa}`)
    if (object.isa === 'XCBuildConfiguration') for (const [key, value] of Object.entries(object.buildSettings || {})) if (inputKey.test(key)) check(value, key)
  }
  for (const file of filesUnder(root, path.join(root, 'Config')).filter(file => file.endsWith('.xcconfig'))) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (/^\s*#include/.test(line)) fail(`xcconfig include requires explicit packaging: ${file}`)
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (match && inputKey.test(match[1])) check(match[2], match[1])
    }
  }
}

export function validateStandalone(projectRoot, document = readProject(projectRoot)) {
  const root = path.resolve(projectRoot)
  if (fs.lstatSync(root).isSymbolicLink()) fail(`symbolic project root: ${root}`)
  assertReferences(document)
  const objects = document.objects
  const project = objects[document.rootObject]
  if (project.projectDirPath || project.projectRoot || project.projectReferences?.length) fail('external project root/reference is not supported')
  const resolved = new Map()
  const visited = new Set()
  const walk = (id, parent, ancestors = new Set()) => {
    const object = objects[id]
    if (!object) fail(`missing group child: ${id}`)
    if (ancestors.has(id)) fail(`cyclic project group: ${id}`)
    if (object.sourceTree === 'BUILT_PRODUCTS_DIR') return
    if (!groupTypes.has(object.isa) && object.isa !== 'PBXFileReference') return
    if (!['<group>', 'SOURCE_ROOT', undefined].includes(object.sourceTree)) fail(`external sourceTree: ${object.sourceTree}`)
    if (object.path && (path.isAbsolute(object.path) || object.path.includes('$'))) fail(`external file reference: ${object.path}`)
    const file = path.resolve(object.sourceTree === 'SOURCE_ROOT' ? root : parent, object.path || '')
    checkedPath(root, file)
    if (resolved.has(id) && resolved.get(id) !== file) fail(`ambiguous group path: ${id}`)
    resolved.set(id, file)
    visited.add(id)
    if (groupTypes.has(object.isa)) for (const child of object.children || []) walk(child, file, new Set([...ancestors, id]))
    else filesUnder(root, file)
  }
  walk(project.mainGroup, root)
  for (const [id, object] of Object.entries(objects)) if (object.isa === 'PBXFileReference' && object.sourceTree !== 'BUILT_PRODUCTS_DIR' && !visited.has(id)) fail(`unresolved fileRef group: ${object.path}`)
  for (const name of productionFiles) filesUnder(root, path.join(root, name))
  validateBuildPaths(root, document)
  const resources = path.join(root, 'CimomusicOrientationPathfinder')
  for (const file of [...facultyHeritageFiles, 'build-manifest.json']) if (fs.existsSync(path.join(resources, file))) fail(`plaintext packaged configuration: ${file}`)
  const festivalPackage = fs.readFileSync(path.join(resources, campusHeritagePathway))
  let catalogue
  try { catalogue = campusHeritageCatalog(festivalPackage) } catch (error) { fail(`H5 package cannot be decrypted or expanded: ${error.message}`) }
  const { manifest, files: academicFiles } = catalogue
  const actual = academicFiles.map(entry => entry.file).sort()
  const academicMap = new Map(academicFiles.map(entry => [entry.file, entry.data]))
  const entries = manifest.files
  if (!Array.isArray(entries) || !entries.length) fail('H5 manifest is empty')
  const names = entries.map(entry => entry.file)
  if (new Set(names).size !== names.length || JSON.stringify(names.toSorted()) !== JSON.stringify(actual)) fail('H5 manifest file set differs from packaged resources')
  for (const entry of entries) {
    if (typeof entry.file !== 'string' || path.isAbsolute(entry.file)) fail('invalid H5 manifest path')
    if (entry.file.includes('..') || entry.file.includes('\\')) fail(`external H5 manifest path: ${entry.file}`)
    if (/CIRCA|interactive|\.dc\.html$/i.test(path.basename(entry.file))) fail(`prototype resource: ${entry.file}`)
    if (crypto.createHash('sha256').update(academicMap.get(entry.file)).digest('hex') !== entry.sha256) fail(`H5 hash mismatch: ${entry.file}`)
  }
  if (!names.includes('index.html')) fail('H5 entry point is missing')
  return { file_references: [...resolved.keys()].filter(id => objects[id].isa === 'PBXFileReference').length, h5_files: entries.length, application_target: project.targets.find(id => objects[id].productType === 'com.apple.product-type.application') }
}

const schemeTransform = `<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:param name="application"/><xsl:output method="xml" indent="yes"/>
<xsl:template match="@*|node()"><xsl:copy><xsl:apply-templates select="@*|node()"/></xsl:copy></xsl:template>
<xsl:template match="Testables/*"/>
<xsl:template match="BuildActionEntry"><xsl:if test="BuildableReference/@BlueprintIdentifier = $application"><xsl:copy><xsl:apply-templates select="@*|node()"/></xsl:copy></xsl:if></xsl:template>
</xsl:stylesheet>`

export function exportStandalone(sourceRoot, destination) {
  const source = path.resolve(sourceRoot)
  const output = path.resolve(destination)
  if (fs.lstatSync(output, { throwIfNoEntry: false })) fail(`output already exists; choose a new --output-dir: ${output}`)
  if (within(source, output) || within(output, source)) fail('output must be separate from the source project')
  const original = readProject(source)
  validateStandalone(source, original)
  const document = productionProject(original)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  // Exclusive creation prevents merging into a folder created after the initial check.
  fs.mkdirSync(output)
  for (const name of productionFiles) fs.cpSync(path.join(source, name), path.join(output, name), { recursive: true, errorOnExist: true, force: false })
  const project = path.join(output, projectName)
  fs.mkdirSync(path.join(project, 'project.xcworkspace'), { recursive: true })
  fs.writeFileSync(path.join(project, 'project.xcworkspace/contents.xcworkspacedata'), '<?xml version="1.0" encoding="UTF-8"?><Workspace version="1.0"><FileRef location="self:"/></Workspace>\n')
  const plist = execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', '-'], { input: JSON.stringify(document) })
  fs.writeFileSync(path.join(project, 'project.pbxproj'), plist)
  const application = document.objects[document.rootObject].targets[0]
  const schemes = path.join(source, projectName, 'xcshareddata/xcschemes')
  const outputSchemes = path.join(project, 'xcshareddata/xcschemes')
  fs.mkdirSync(outputSchemes, { recursive: true })
  for (const name of fs.readdirSync(schemes).filter(name => name.endsWith('.xcscheme'))) {
    const input = checkedPath(source, path.join(schemes, name))
    if (/<!DOCTYPE|<!ENTITY/.test(fs.readFileSync(input, 'utf8'))) fail(`scheme declarations are not allowed: ${name}`)
    if (execFileSync('/usr/bin/xmllint', ['--nonet', '--xpath', 'count(//ExecutionAction)', input], { encoding: 'utf8' }).trim() !== '0') fail(`scheme build scripts are not allowed: ${name}`)
    const scheme = execFileSync('/usr/bin/xsltproc', ['--nonet', '--stringparam', 'application', application, '-', input], { input: schemeTransform })
    const file = path.join(outputSchemes, name)
    fs.writeFileSync(file, scheme)
    const invalid = execFileSync('/usr/bin/xmllint', ['--nonet', '--xpath', `count(//BuildableReference[@BlueprintIdentifier != '${application}' or @ReferencedContainer != 'container:${projectName}']) + count(//Testables/*)`, file], { encoding: 'utf8' }).trim()
    if (invalid !== '0') fail(`scheme contains an external or test target reference: ${name}`)
  }
  return validateStandalone(output, document)
}
