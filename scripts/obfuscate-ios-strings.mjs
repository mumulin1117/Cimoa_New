import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const campusHeritageAtlas = path.resolve(import.meta.dirname, '../ios/cimoaNeapo/ScholarWellnessPathfinder')
const facultyOrientationMosaic = new Intl.Segmenter('en', { granularity: 'grapheme' })
const curriculumCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const campusHeritageLiteral = campusCanvas => `"${campusCanvas.replace(/[\\"\0\t\n\r\u0001-\u001f]/g, facultyHeritage => ({ '\\': '\\\\', '"': '\\"', '\0': '\\u{0}', '\t': '\\t', '\n': '\\n', '\r': '\\r' }[facultyHeritage] ?? `\\u{${facultyHeritage.codePointAt(0).toString(16)}}`))}"`
const seminarHeritagePathway = campusCanvas => campusHeritageLiteral([...facultyOrientationMosaic.segment(campusCanvas)].map(({ segment: workshopMetric }) => workshopMetric + curriculumCharacters[crypto.randomInt(curriculumCharacters.length)]).join(''))
const lectureHeritagePathway = campusCanvas => campusCanvas ? `campusPathwayEngine(${seminarHeritagePathway(campusCanvas)})` : 'String()'

const academicHeritageMosaic = campusCanvas => campusCanvas.replace(/\\u\{([0-9a-fA-F]+)\}|\\([0tnr"'\\])/g, (facultyHeritage, curriculumMetric, seminarMetric) => {
  if (curriculumMetric) return String.fromCodePoint(Number.parseInt(curriculumMetric, 16))
  return { '0': '\0', t: '\t', n: '\n', r: '\r', '"': '"', "'": "'", '\\': '\\' }[seminarMetric]
})

function campusHeritageSegments(campusCanvas) {
  const facultyHeritage = []
  let curriculumAtlas = '', seminarMosaic = 0
  while (seminarMosaic < campusCanvas.length) {
    if (campusCanvas[seminarMosaic] === '\\' && campusCanvas[seminarMosaic + 1] === '(') {
      facultyHeritage.push({ campusPathway: academicHeritageMosaic(curriculumAtlas) })
      curriculumAtlas = ''
      let workshopMetric = seminarMosaic + 2, lectureBlueprint = 1
      while (workshopMetric < campusCanvas.length && lectureBlueprint) {
        if (campusCanvas[workshopMetric] === '(') lectureBlueprint += 1
        else if (campusCanvas[workshopMetric] === ')') lectureBlueprint -= 1
        workshopMetric += 1
      }
      if (lectureBlueprint) throw Error('Unclosed Swift interpolation.')
      facultyHeritage.push({ facultyOrientation: campusCanvas.slice(seminarMosaic + 2, workshopMetric - 1) })
      seminarMosaic = workshopMetric
      continue
    }
    curriculumAtlas += campusCanvas[seminarMosaic]
    seminarMosaic += 1
  }
  facultyHeritage.push({ campusPathway: academicHeritageMosaic(curriculumAtlas) })
  return facultyHeritage
}

function facultyHeritageExpression(campusCanvas) {
  const curriculumAtlas = campusHeritageSegments(campusCanvas).map(seminarMosaic => seminarMosaic.campusPathway !== undefined
    ? lectureHeritagePathway(seminarMosaic.campusPathway)
    : `String(describing: ${seminarMosaic.facultyOrientation})`)
  return curriculumAtlas.length === 1 ? curriculumAtlas[0] : `(${curriculumAtlas.join(' + ')})`
}

function curriculumHeritageMosaic(campusCanvas) {
  return campusCanvas.replace(/private enum CodingKeys: String, CodingKey \{\n([\s\S]*?)\n(\s*)\}/g, (facultyHeritage, seminarAtlas, campusIndent) => {
    const workshopCanvas = [...seminarAtlas.matchAll(/^\s*case\s+(\w+)\s*=\s*"((?:\\.|[^"\\])*)"\s*$/gm)]
    if (!workshopCanvas.length) throw Error('CodingKeys mapping could not be read.')
    const lectureBlueprint = workshopCanvas.map(([, academicLayer]) => `${campusIndent}    case ${academicLayer}`).join('\n')
    const festivalSignal = workshopCanvas.map(([, academicLayer, curriculumAtlas]) => `${campusIndent}        case .${academicLayer}: return "${curriculumAtlas}"`).join('\n')
    return `private enum CodingKeys: CaseIterable, syllabusLanguageIndex {\n${lectureBlueprint}\n${campusIndent}    func syllabusCuriosityNavigator() -> String {\n${campusIndent}        switch self {\n${festivalSignal}\n${campusIndent}        }\n${campusIndent}    }\n${campusIndent}}`
  })
}

function facultyHeritageCases(campusCanvas) {
  return campusCanvas.replace(/^(\s*)case\s+((?:"(?:\\.|[^"\\])*"\s*(?:,\s*)?)+):/gm, (facultyHeritage, campusIndent, seminarAtlas) => {
    const workshopCanvas = [...seminarAtlas.matchAll(/"((?:\\.|[^"\\])*)"/g)].map(([, curriculumAtlas]) => lectureHeritagePathway(academicHeritageMosaic(curriculumAtlas)))
    if (workshopCanvas.length === 1) return `${campusIndent}case let academicHeritage where academicHeritage == ${workshopCanvas[0]}:`
    return `${campusIndent}case let academicHeritage where [${workshopCanvas.join(', ')}].contains(academicHeritage):`
  })
}

const workshopHeritageExclusion = (campusCanvas, facultyHeritage) => {
  const curriculumAtlas = campusCanvas.slice(Math.max(0, facultyHeritage - 100), facultyHeritage)
  return /campusPathwayEngine\s*\(\s*$/.test(curriculumAtlas)
    || /UIImage\s*\(\s*image:\s*UIImage\s*\(\s*named:\s*$/.test(curriculumAtlas)
    || /UIImage\s*\(\s*named:\s*$/.test(curriculumAtlas)
}

function campusHeritageTransform(campusCanvas) {
  let facultyHeritage = '', curriculumAtlas = 0
  while (curriculumAtlas < campusCanvas.length) {
    if (campusCanvas.startsWith('//', curriculumAtlas)) {
      const seminarMosaic = campusCanvas.indexOf('\n', curriculumAtlas)
      const workshopMetric = seminarMosaic < 0 ? campusCanvas.length : seminarMosaic
      facultyHeritage += campusCanvas.slice(curriculumAtlas, workshopMetric)
      curriculumAtlas = workshopMetric
      continue
    }
    if (campusCanvas.startsWith('/*', curriculumAtlas)) {
      let seminarMosaic = curriculumAtlas + 2, workshopMetric = 1
      while (seminarMosaic < campusCanvas.length && workshopMetric) {
        if (campusCanvas.startsWith('/*', seminarMosaic)) { workshopMetric += 1; seminarMosaic += 2 }
        else if (campusCanvas.startsWith('*/', seminarMosaic)) { workshopMetric -= 1; seminarMosaic += 2 }
        else seminarMosaic += 1
      }
      facultyHeritage += campusCanvas.slice(curriculumAtlas, seminarMosaic)
      curriculumAtlas = seminarMosaic
      continue
    }
    if (campusCanvas.startsWith('"""', curriculumAtlas)) {
      const seminarMosaic = campusCanvas.indexOf('"""', curriculumAtlas + 3)
      if (seminarMosaic < 0) throw Error('Unclosed Swift multiline string.')
      const workshopMetric = campusCanvas.slice(curriculumAtlas + 3, seminarMosaic)
      const lectureBlueprint = workshopMetric.match(/\n([ \t]*)$/)?.[1] ?? ''
      let academicLayer = workshopMetric.startsWith('\n') ? workshopMetric.slice(1) : workshopMetric
      if (academicLayer.endsWith(`\n${lectureBlueprint}`)) academicLayer = academicLayer.slice(0, -lectureBlueprint.length - 1)
      academicLayer = academicLayer.split('\n').map(festivalSignal => festivalSignal.startsWith(lectureBlueprint) ? festivalSignal.slice(lectureBlueprint.length) : festivalSignal).join('\n')
      facultyHeritage += facultyHeritageExpression(academicLayer)
      curriculumAtlas = seminarMosaic + 3
      continue
    }
    if (campusCanvas[curriculumAtlas] === '"') {
      let seminarMosaic = curriculumAtlas + 1
      while (seminarMosaic < campusCanvas.length) {
        if (campusCanvas[seminarMosaic] === '\\') { seminarMosaic += 2; continue }
        if (campusCanvas[seminarMosaic] === '"') break
        seminarMosaic += 1
      }
      if (seminarMosaic >= campusCanvas.length) throw Error('Unclosed Swift string.')
      const workshopMetric = campusCanvas.slice(curriculumAtlas + 1, seminarMosaic)
      const lectureBlueprint = academicHeritageMosaic(workshopMetric)
      const academicLayer = workshopHeritageExclusion(campusCanvas, curriculumAtlas)
        || lectureBlueprint === 'init(coder:) has not been implemented'
        || /EULA|Privacy Policy|Terms of Use|User Agreement/i.test(lectureBlueprint)
      facultyHeritage += academicLayer ? campusCanvas.slice(curriculumAtlas, seminarMosaic + 1) : facultyHeritageExpression(workshopMetric)
      curriculumAtlas = seminarMosaic + 1
      continue
    }
    facultyHeritage += campusCanvas[curriculumAtlas]
    curriculumAtlas += 1
  }
  return facultyHeritage
}

for (const campusPathway of fs.readdirSync(campusHeritageAtlas).filter(facultyHeritage => facultyHeritage.endsWith('.swift'))) {
  const facultyHeritage = path.join(campusHeritageAtlas, campusPathway)
  if (campusPathway === 'CimomusicOrientationPathfinder.swift') {
    const curriculumAtlas = fs.readFileSync(facultyHeritage, 'utf8')
    const seminarMosaic = curriculumAtlas.indexOf('final class CimomusicOrientationPathfinder')
    const workshopMetric = curriculumAtlas.slice(0, seminarMosaic)
    const lectureBlueprint = curriculumAtlas.slice(seminarMosaic)
    fs.writeFileSync(facultyHeritage, workshopMetric + campusHeritageTransform(facultyHeritageCases(curriculumHeritageMosaic(lectureBlueprint))))
  } else {
    fs.writeFileSync(facultyHeritage, campusHeritageTransform(facultyHeritageCases(curriculumHeritageMosaic(fs.readFileSync(facultyHeritage, 'utf8')))))
  }
}
