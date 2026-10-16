import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' }
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
export const close_to = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

export async function serve_h5(root = path.resolve('dist/build/h5')) {
  const server = http.createServer((request, response) => {
    const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(response)
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return { origin: `http://127.0.0.1:${server.address().port}`, pid: process.pid, close: () => new Promise(resolve => server.close(resolve)) }
}

export async function context_for(browser, key, data, viewport = { width: 393, height: 852 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(({ key: storage_key, data: initial }) => { if (!localStorage.getItem(storage_key)) localStorage.setItem(storage_key, JSON.stringify({ type: 'object', data: initial })) }, { key, data })
  return context
}

export async function set_safe_area(page, top, bottom) {
  await page.evaluate(({ top: safe_top, bottom: safe_bottom }) => { document.documentElement.style.setProperty('--native-safe-area-top', `${safe_top}px`); document.documentElement.style.setProperty('--native-safe-area-bottom', `${safe_bottom}px`) }, { top, bottom })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

export async function write_comparison(browser, output, reference_path, actual_path) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), encoded = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
  const result = await page.evaluate(async ({ reference, actual }) => {
    const load = source => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source })
    const [a, b] = await Promise.all([load(reference), load(actual)]), canvas = document.createElement('canvas'); canvas.width = a.width; canvas.height = a.height
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(a, 0, 0); const first = context.getImageData(0, 0, canvas.width, canvas.height); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(b, 0, 0); const second = context.getImageData(0, 0, canvas.width, canvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(a, 0, 0); context.globalAlpha = .5; context.drawImage(b, 0, 0); context.globalAlpha = 1; const overlay = canvas.toDataURL('image/png'), diff = context.createImageData(canvas.width, canvas.height)
    let exact = 0, above8 = 0, sum = 0, max = 0
    for (let index = 0; index < first.data.length; index += 4) { const channels = [0, 1, 2, 3].map(offset => Math.abs(first.data[index + offset] - second.data[index + offset])), delta = Math.max(...channels); if (delta) exact++; if (delta > 8) above8++; sum += channels.reduce((total, value) => total + value, 0); max = Math.max(max, delta); diff.data[index] = Math.min(255, channels[0] * 4); diff.data[index + 1] = Math.min(255, channels[1] * 4); diff.data[index + 2] = Math.min(255, channels[2] * 4); diff.data[index + 3] = 255 }
    context.putImageData(diff, 0, 0); return { overlay, diff: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, pixels_different: exact, pixels_above_channel_delta_8: above8, mean_absolute_channel_delta: sum / first.data.length, max_channel_delta: max }
  }, { reference: encoded(reference_path), actual: encoded(actual_path) })
  const decode = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64'); fs.writeFileSync(path.join(output, 'overlay.png'), decode(result.overlay)); fs.writeFileSync(path.join(output, 'diff.png'), decode(result.diff)); delete result.overlay; delete result.diff; await page.close(); return result
}
