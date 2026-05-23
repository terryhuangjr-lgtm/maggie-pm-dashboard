/**
 * GET /api/dropbox-list
 *
 * Lists files in a property's Dropbox folder under /Property Management_MH Group.
 * Self-contained — no local imports.
 */

const API_BASE = 'https://api.dropboxapi.com/2'

function sanitizeName(name) {
  return String(name || '').replace(/[<>:"/\\|?*#]/g, '_').trim()
}

function getToken() {
  const token = process.env.DROPBOX_ACCESS_TOKEN
  if (!token) throw new Error('DROPBOX_ACCESS_TOKEN not set')
  return token
}

async function listFolder(path = '') {
  const res = await fetch(`${API_BASE}/files/list_folder`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, limit: 200 }),
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 409) throw Object.assign(new Error('not_found'), { status: 409 })
    throw new Error(`Dropbox list failed (${res.status}): ${text}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const property = req.query.property || req.query.address
    if (!property) {
      return res.status(400).json({ error: 'property query param required' })
    }

    const root = process.env.DROPBOX_ROOT || '/Property Management_MH Group'
    const folderPath = `${root}/Properties/${sanitizeName(property)}`

    const result = await listFolder(folderPath)
    const entries = (result.entries || []).map(entry => ({
      name: entry.name,
      path: entry.path_display || entry.path_lower,
      type: entry['.tag'],
      size: entry.size || 0,
      modified: entry.server_modified || entry.client_modified || null,
    }))

    return res.status(200).json({ entries, root: folderPath })
  } catch (err) {
    if (err.message === 'not_found' || err.status === 409) {
      return res.status(200).json({ entries: [], root: '' })
    }
    console.error('Dropbox list error:', err)
    return res.status(500).json({ error: err.message || 'List failed' })
  }
}
