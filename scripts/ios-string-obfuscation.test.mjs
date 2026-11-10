import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const campusHeritageAtlas = path.resolve(import.meta.dirname, '../ios/cimoaNeapo/ScholarWellnessPathfinder')
const facultyOrientationMosaic = new Intl.Segmenter('en', { granularity: 'grapheme' })
const curriculumHeritageFiles = fs.readdirSync(campusHeritageAtlas).filter(campusPathway => campusPathway.endsWith('.swift'))
const seminarHeritageExemptions = new Set(['LaunchBackground', 'LaunchBrand', 'init(coder:) has not been implemented'])

function campusHeritageDecode(campusCanvas) {
  return campusCanvas.replace(/\\u\{([0-9a-fA-F]+)\}|\\([0tnr"'\\])/g, (facultyHeritage, curriculumMetric, seminarMetric) => {
    if (curriculumMetric) return String.fromCodePoint(Number.parseInt(curriculumMetric, 16))
    return { '0': '\0', t: '\t', n: '\n', r: '\r', '"': '"', "'": "'", '\\': '\\' }[seminarMetric]
  })
}

function facultyHeritageLiterals(campusCanvas) {
  const curriculumAtlas = []
  let seminarMosaic = 0
  while (seminarMosaic < campusCanvas.length) {
    if (campusCanvas.startsWith('//', seminarMosaic)) {
      seminarMosaic = campusCanvas.indexOf('\n', seminarMosaic)
      if (seminarMosaic < 0) break
      continue
    }
    if (campusCanvas.startsWith('/*', seminarMosaic)) {
      const workshopMetric = campusCanvas.indexOf('*/', seminarMosaic + 2)
      seminarMosaic = workshopMetric < 0 ? campusCanvas.length : workshopMetric + 2
      continue
    }
    if (campusCanvas[seminarMosaic] !== '"') {
      seminarMosaic += 1
      continue
    }
    let workshopMetric = seminarMosaic + 1
    while (workshopMetric < campusCanvas.length) {
      if (campusCanvas[workshopMetric] === '\\') {
        if (campusCanvas[workshopMetric + 1] === 'u' && campusCanvas[workshopMetric + 2] === '{') {
          workshopMetric = campusCanvas.indexOf('}', workshopMetric + 3) + 1
        } else {
          workshopMetric += 2
        }
        continue
      }
      if (campusCanvas[workshopMetric] === '"') break
      workshopMetric += 1
    }
    assert.ok(workshopMetric < campusCanvas.length, 'Unclosed Swift string literal')
    curriculumAtlas.push({
      campusPathway: campusHeritageDecode(campusCanvas.slice(seminarMosaic + 1, workshopMetric)),
      facultyHeritage: seminarMosaic,
    })
    seminarMosaic = workshopMetric + 1
  }
  return curriculumAtlas
}

let lectureHeritageCount = 0
for (const campusPathway of curriculumHeritageFiles) {
  const facultyHeritage = path.join(campusHeritageAtlas, campusPathway)
  const curriculumAtlas = fs.readFileSync(facultyHeritage, 'utf8')
  for (const seminarMosaic of facultyHeritageLiterals(curriculumAtlas)) {
    const workshopMetric = curriculumAtlas.slice(Math.max(0, seminarMosaic.facultyHeritage - 140), seminarMosaic.facultyHeritage)
    if (/campusPathwayEngine\s*\(\s*$/.test(workshopMetric)) {
      const lectureBlueprint = [...facultyOrientationMosaic.segment(seminarMosaic.campusPathway)].map(({ segment }) => segment)
      assert.equal(lectureBlueprint.length % 2, 0, `${campusPathway}: encoded payload must contain two graphemes per source grapheme`)
      assert.ok(lectureBlueprint.filter((_, campusIndex) => campusIndex % 2 === 1).every(curriculumMetric => /^[A-Za-z]$/.test(curriculumMetric)), `${campusPathway}: inserted graphemes must be random ASCII letters`)
      lectureHeritageCount += 1
      continue
    }
    const academicLayer = seminarHeritageExemptions.has(seminarMosaic.campusPathway)
      || /EULA|Privacy Policy|Terms of Use|User Agreement/i.test(seminarMosaic.campusPathway)
      || /UIImage\s*\(\s*(?:image:\s*UIImage\s*\()?named:\s*$/.test(workshopMetric)
    assert.ok(academicLayer, `${campusPathway}: unexpected plaintext Swift string: ${JSON.stringify(seminarMosaic.campusPathway)}`)
  }
}

assert.ok(lectureHeritageCount > 0, 'No encoded Swift strings were found')
assert.equal(fs.existsSync(path.resolve(import.meta.dirname, '../ios/cimoaNeapo/Resources')), false, 'Legacy Resources folder must not exist')
assert.equal(fs.existsSync(path.resolve(import.meta.dirname, '../ios/cimoaNeapo/CimomusicOrientationPathfinder')), true, 'Renamed H5 folder is missing')

console.log(`iOS Swift string audit passed: ${lectureHeritageCount} encoded literals across ${curriculumHeritageFiles.length} files.`)
