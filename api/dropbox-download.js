/**
 * GET /api/dropbox-download
 *
 * Gets a temporary download link for a file.
 * Self-contained — no local imports.
 */

const API_BASE = 'https://api.dropboxapi.com/2'

function getToken() {
  const token = process.env.DROPBOX_ACCESS_TOKEN
  if (!token) throw new Error('DROPBOX_ACCESS_TOKEN not set')
  return token
}

async function getTemporaryLink(path) {
  const res = await fetch(`${API_BASE}/files/get_temporary_link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Dropbox temp link failed (${res.status}): ${text}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { path } = req.query
    if (!path) return res.status(400).json({ error: 'path query param required' })

    const link = await getTemporaryLink(path)
    return res.status(200).json({ url: link.link, name: path.split('/').pop() })
  } catch (err) {
    console.error('Dropbox download error:', err)
    return res.status(500).json({ error: err.message || 'Download failed' })
  }
}
