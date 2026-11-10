import crypto from 'node:crypto'
import zlib from 'node:zlib'

export const campusHeritagePathway = 'campusHeritagePathway.cimoa'
export const facultyOrientationMosaic = 'campusHeritagePathwayMosaicAtlas'

const curriculumAtlas = Buffer.from('CIMOAH51')
export const campusHeritageSchema = Buffer.from('CIMOAP52')
export const facultyHeritageFiles = ['iap-products.json', 'startup-motion.json', 'theme.json']

const lectureBlueprint = (seminarCanvas, workshopMetric) => {
  const syllabusLayer = Buffer.alloc(workshopMetric)
  seminarCanvas(syllabusLayer)
  return syllabusLayer
}

export function facultyHeritageMosaic(academicFiles) {
  const festivalLayers = [curriculumAtlas, lectureBlueprint(campusCanvas => campusCanvas.writeUInt32BE(academicFiles.length), 4)]
  for (const academicFile of academicFiles) {
    const campusPathway = Buffer.from(academicFile.file, 'utf8')
    const facultyHeritage = Buffer.from(academicFile.data)
    festivalLayers.push(lectureBlueprint(campusCanvas => campusCanvas.writeUInt32BE(campusPathway.length), 4))
    festivalLayers.push(lectureBlueprint(campusCanvas => campusCanvas.writeBigUInt64BE(BigInt(facultyHeritage.length)), 8))
    festivalLayers.push(campusPathway, facultyHeritage)
  }
  return Buffer.concat(festivalLayers)
}

export function campusOrientationEngine(academicFiles) {
  const syllabusMosaic = facultyHeritageMosaic(academicFiles)
  const seminarAtlas = zlib.deflateRawSync(syllabusMosaic, { level: 9 })
  const workshopCanvas = zlib.deflateRawSync(seminarAtlas, { level: 9 })
  const curriculumKey = crypto.createHash('sha256').update(facultyOrientationMosaic).digest()
  const lectureOrbit = crypto.randomBytes(12)
  const academicGateway = crypto.createCipheriv('aes-256-gcm', curriculumKey, lectureOrbit)
  const facultyLayer = Buffer.concat([academicGateway.update(workshopCanvas), academicGateway.final()])
  return Buffer.concat([lectureOrbit, facultyLayer, academicGateway.getAuthTag()])
}

export function campusHeritageIndex(festivalPackage) {
  return crypto.createHash('sha256').update(festivalPackage).digest('hex')
}

export function campusAcademicAtlas(festivalPackage) {
  if (festivalPackage.length <= 28) throw Error('Invalid campus pathway bundle.')
  const curriculumKey = crypto.createHash('sha256').update(facultyOrientationMosaic).digest()
  const lectureOrbit = festivalPackage.subarray(0, 12)
  const workshopMetric = festivalPackage.subarray(festivalPackage.length - 16)
  const facultyLayer = festivalPackage.subarray(12, festivalPackage.length - 16)
  const academicGateway = crypto.createDecipheriv('aes-256-gcm', curriculumKey, lectureOrbit)
  academicGateway.setAuthTag(workshopMetric)
  const workshopCanvas = Buffer.concat([academicGateway.update(facultyLayer), academicGateway.final()])
  const seminarAtlas = zlib.inflateRawSync(workshopCanvas, { maxOutputLength: 536870912 })
  const syllabusMosaic = zlib.inflateRawSync(seminarAtlas, { maxOutputLength: 536870912 })
  let curriculumIndex = 0
  const facultyHeritage = workshopCanvas => {
    if (curriculumIndex + workshopCanvas > syllabusMosaic.length) throw Error('Invalid campus pathway bundle.')
    const academicLayer = syllabusMosaic.subarray(curriculumIndex, curriculumIndex + workshopCanvas)
    curriculumIndex += workshopCanvas
    return academicLayer
  }
  if (!facultyHeritage(curriculumAtlas.length).equals(curriculumAtlas)) throw Error('Invalid campus pathway bundle.')
  const festivalLayers = facultyHeritage(4).readUInt32BE()
  if (!festivalLayers || festivalLayers > 10000) throw Error('Invalid campus pathway bundle.')
  const academicFiles = []
  for (let campusCanvas = 0; campusCanvas < festivalLayers; campusCanvas += 1) {
    const campusPathwayLength = facultyHeritage(4).readUInt32BE()
    const facultyHeritageLength = Number(facultyHeritage(8).readBigUInt64BE())
    const campusPathway = facultyHeritage(campusPathwayLength).toString('utf8')
    if (!campusPathway || campusPathway.startsWith('/') || campusPathway.includes('\\') || campusPathway.split('/').some(part => !part || part === '.' || part === '..') || academicFiles.some(entry => entry.file === campusPathway)) throw Error('Invalid campus pathway bundle.')
    academicFiles.push({ file: campusPathway, data: Buffer.from(facultyHeritage(facultyHeritageLength)) })
  }
  if (curriculumIndex !== syllabusMosaic.length) throw Error('Invalid campus pathway bundle.')
  return academicFiles
}

export function campusHeritageBundle(academicFiles, facultyFiles) {
  const facultyLayers = new Map(facultyFiles.map(entry => [entry.file, entry.data]))
  if (facultyLayers.size !== facultyFiles.length || facultyHeritageFiles.some(file => !facultyLayers.has(file)) || facultyLayers.size !== facultyHeritageFiles.length) throw Error('Invalid campus configuration set.')
  const festivalPackage = campusOrientationEngine(academicFiles)
  const lectureIndex = entries => entries.map(({ file, data }) => ({ file, sha256: campusHeritageIndex(data) }))
  const seminarAtlas = {
    version: 2, project: 'cimoaNeapo', source: 'dist/build/h5', package: campusHeritagePathway,
    payload_sha256: campusHeritageIndex(festivalPackage), compression_layers: 2, encryption: 'AES-256-GCM',
    files: lectureIndex(academicFiles), configurations: lectureIndex(facultyFiles),
  }
  const workshopCanvas = campusOrientationEngine([...facultyFiles, { file: 'build-manifest.json', data: Buffer.from(JSON.stringify(seminarAtlas) + '\n') }])
  return Buffer.concat([campusHeritageSchema, lectureBlueprint(canvas => canvas.writeUInt32BE(workshopCanvas.length), 4), workshopCanvas, festivalPackage])
}

export function campusHeritageCatalog(festivalPackage) {
  if (festivalPackage.length < 12 || !festivalPackage.subarray(0, 8).equals(campusHeritageSchema)) throw Error('Invalid campus package header.')
  const workshopMetric = festivalPackage.readUInt32BE(8)
  if (workshopMetric <= 28 || workshopMetric > 1048576 || 12 + workshopMetric + 28 >= festivalPackage.length) throw Error('Invalid campus configuration length.')
  const facultyFiles = campusAcademicAtlas(festivalPackage.subarray(12, 12 + workshopMetric))
  const facultyLayers = new Map(facultyFiles.map(entry => [entry.file, entry.data]))
  const seminarAtlas = JSON.parse(facultyLayers.get('build-manifest.json')?.toString('utf8') || 'null')
  if (facultyLayers.size !== 4 || facultyHeritageFiles.some(file => !facultyLayers.has(file)) || seminarAtlas?.version !== 2 || seminarAtlas.package !== campusHeritagePathway || seminarAtlas.compression_layers !== 2 || seminarAtlas.encryption !== 'AES-256-GCM') throw Error('Invalid campus configuration manifest.')
  const curriculumCanvas = festivalPackage.subarray(12 + workshopMetric)
  if (campusHeritageIndex(curriculumCanvas) !== seminarAtlas.payload_sha256) throw Error('H5 package hash mismatch.')
  const academicFiles = campusAcademicAtlas(curriculumCanvas)
  const lectureIndex = (entries, actual) => {
    if (!Array.isArray(entries) || !entries.length || new Set(entries.map(entry => entry.file)).size !== entries.length || JSON.stringify(entries.map(entry => entry.file).sort()) !== JSON.stringify(actual.map(entry => entry.file).sort())) throw Error('Campus manifest file set differs from packaged resources.')
    const layers = new Map(actual.map(entry => [entry.file, entry.data]))
    for (const entry of entries) if (campusHeritageIndex(layers.get(entry.file)) !== entry.sha256) throw Error(`Campus hash mismatch: ${entry.file}`)
  }
  lectureIndex(seminarAtlas.configurations, facultyFiles.filter(entry => entry.file !== 'build-manifest.json'))
  lectureIndex(seminarAtlas.files, academicFiles)
  if (!academicFiles.some(entry => entry.file === 'index.html')) throw Error('H5 entry point is missing.')
  return { manifest: seminarAtlas, configurations: facultyFiles, files: academicFiles }
}
