/**
 * POST /api/dropbox-upload
 *
 * Uploads a file to the property's folder under /Property Management_MH Group.
 * Self-contained — no local imports.
 */

const API_BASE = 'https://api.dropboxapi.com/2'
const CONTENT_BASE = 'https://content.dropboxapi.com/2'

function sanitizeName(name) {
  return String(name || '').replace(/[<>:"/\\|?*#]/g, '_').trim()
}

function getToken() {
  const token = process.env.DROPBOX_ACCESS_TOKEN
  if (!token) throw new Error('DROPBOX_ACCESS_TOKEN not set')
  return token
}

async function createFolder(path) {
  const res = await fetch(`${API_BASE}/files/create_folder_v2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, autorename: false }),
  })
  if (!res.ok) {
    const text = await res.text()
    if (text.includes('conflict')) return null
    throw new Error(`Dropbox create folder failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function uploadFile(path, contents) {
  const res = await fetch(`${CONTENT_BASE}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: true, mute: true }),
    },
    body: contents,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Dropbox upload failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function createSharedLink(path) {
  const res = await fetch(`${API_BASE}/sharing/create_shared_link_with_settings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, settings: { requested_visibility: { '.tag': 'shared' } } }),
  })
  if (!res.ok) {
    const text = await res.text()
    if (text.includes('shared_link_already_exists')) return null
    throw new Error(`Dropbox link failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function listSharedLinks(path) {
  const res = await fetch(`${API_BASE}/sharing/list_shared_links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, direct_only: true }),
  })
  if (!res.ok) return null
  return res.json()
}

async function parseMultipart(req) {
  const contentType = req.headers['content-type'] || ''
  const boundary = contentType.split('boundary=')[1]
  if (!boundary) throw new Error('No boundary in content-type')

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks)
  const boundaryBuffer = Buffer.from(`--${boundary}`)

  const Fields = {}
  const Files = {}
  let pos = 0

  while (pos < body.length) {
    const start = body.indexOf(boundaryBuffer, pos)
    if (start === -1) break
    const sectionStart = start + boundaryBuffer.length
    if (body.slice(sectionStart, sectionStart + 2).toString() === '--') break

    const nextStart = body.indexOf(boundaryBuffer, sectionStart)
    const section = body.slice(sectionStart, nextStart !== -1 ? nextStart : body.length)
    const headerEnd = section.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue

    const headerBlock = section.slice(0, headerEnd).toString()
    const contentStart = headerEnd + 4
    const content = section.slice(contentStart, section.length - 2)
    const nameMatch = headerBlock.match(/name="([^"]+)"/)
    const filenameMatch = headerBlock.match(/filename="([^"]+)"/)
    const name = nameMatch ? nameMatch[1] : ''

    if (filenameMatch) {
      if (!Files[name]) Files[name] = []
      Files[name].push({
        name: filenameMatch[1],
        content,
        contentType: headerBlock.match(/Content-Type:\s*(\S+)/)?.[1] || 'application/octet-stream',
      })
    } else {
      if (!Fields[name]) Fields[name] = []
      Fields[name].push(content.toString().trim())
    }

    if (nextStart === -1) break
    pos = nextStart
  }

  return { Fields, Files }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { Fields, Files } = await parseMultipart(req)
    const address = Fields?.property?.[0] || Fields?.address?.[0] || 'Shared'
    const file = Files?.file?.[0]

    if (!file) return res.status(400).json({ error: 'No file provided' })

    const root = process.env.DROPBOX_ROOT || '/Property Management_MH Group'
    const folderPath = `${root}/Properties/${sanitizeName(address)}`
    const dropboxPath = `${folderPath}/${sanitizeName(file.name || 'document.pdf')}`

    await createFolder(folderPath)
    const result = await uploadFile(dropboxPath, file.content)

    let sharedLink = null
    try {
      const linkResult = await createSharedLink(dropboxPath)
      sharedLink = linkResult?.url || null
    } catch {
      const existing = await listSharedLinks(dropboxPath)
      sharedLink = existing?.links?.[0]?.url || null
    }

    return res.status(200).json({
      success: true,
      path: dropboxPath,
      url: sharedLink,
      name: sanitizeName(file.name || 'document.pdf'),
      size: result.size || file.content.length,
    })
  } catch (err) {
    console.error('Dropbox upload error:', err)
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
