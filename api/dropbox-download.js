/**
 * GET /api/dropbox-download
 *
 * Gets a temporary download link for a file.
 *
 * Query params:
 *   - path (string): full Dropbox path to the file
 *
 * Returns:
 *   { url: "...", name: "..." }
 */

import { dropboxV2Api } from './_dropbox.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { path } = req.query

    if (!path) {
      return res.status(400).json({ error: 'path query param required' })
    }

    const link = await dropboxV2Api.getTemporaryLink({ path })
    return res.status(200).json({ url: link.link, name: path.split('/').pop() })
  } catch (err) {
    console.error('Dropbox download error:', err)
    return res.status(500).json({ error: err.message || 'Download failed' })
  }
}
