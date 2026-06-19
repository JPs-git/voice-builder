import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const port = parseInt(process.argv[2], 10) || 3000
const root = __dirname

http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url
  file = path.join(root, file)

  try {
    const content = fs.readFileSync(file)
    const ext = path.extname(file)
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
    res.end(content)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('404 Not Found')
  }
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
